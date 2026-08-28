---
title: 解决 Arch/Hyprland 环境下引入 Nix 导致 Dolphin 无法自动关联打开应用的问题
description: 测试发现 Dolphin 无法自动关联打开应用。经过排查，发现是 Nix 变动路径导致的缓存问题。
tags:
  - dolphin
  - issue
date: '2026-08-22T09:41:23.683Z'
---

# TL;DR
Nix 变动 `$XDG_DATA_DIRS` 导致 KSycoca 缓存失效，进而无法自动关联打开应用。执行 `kbuildsycoca6 --noincremental` 即可修复。

# 起因
本人使用的是 Arch Linux，抱着学习 Nix 的心态，近两个月在 Arch 上安装了 Nix。后来发现 Dolphin 时好时坏，表现为无法自动关联打开应用，也无法选择打开方式。起初我以为是 Hyprland 与 Dolphin 的冲突，直到有一天忍无可忍，便开始着手排查。

# 问题排查
首先排查了 `$XDG_MENU_PREFIX`。因为在非 KDE 桌面环境下，系统无法自动生成 Dolphin 所需的 `.menu` 文件，需要安装 `archlinux-xdg-menu` 包才能实现相关文件的生成；同时 `$XDG_MENU_PREFIX` 也要设置为 `arch-` 以取代 `plasma-`。

具体文件位置在 `/etc/xdg/menus/`，如下所示：

```shell
⋊> ~ ls -l /etc/xdg/menus                                                                                                                                           17:38:14
total 48
drwxr-xr-x 1 root root   30 Mar  2 18:10 applications-merged/
-rw-r--r-- 1 root root 3544 Jan  8  2026 arch-applications.menu
-rw-r--r-- 1 root root 5705 Apr 21 13:21 lxqt-applications-compact.menu
-rw-r--r-- 1 root root 4060 Apr 21 13:21 lxqt-applications-fm.menu
-rw-r--r-- 1 root root 5526 Apr 21 13:21 lxqt-applications.menu
-rw-r--r-- 1 root root 2219 Apr 21 13:21 lxqt-config.menu
-rw-r--r-- 1 root root 5549 Apr 21 13:21 lxqt-panel-applications.menu
-rw-r--r-- 1 root root 9904 Aug  5 15:51 plasma-applications.menu
⋊> ~   

# plasma-applications.menu 是 KDE 环境自动生成的
# arch-applications.menu 是 archlinux-xdg-menu 生成的
```

由此可见这里配置没有问题，但 Dolphin 依然不能正常打开文件，于是开始排查其他配置。

# 发现问题
查看环境变量：

```shell
⋊> ~ echo "$XDG_DATA_DIRS"                                                       
/usr/local/share:/usr/share:/home/dragonren/.nix-profile/share:/nix/var/nix/profiles/default/share
```

发现其中有 Nix 的配置，担心可能是与 Nix 的路径产生了冲突。

于是尝试执行：
```shell
env XDG_DATA_DIRS=/usr/local/share:/usr/share dolphin
```

测试发现恢复正常了，由此断定很可能是 Nix 变动了该变量导致的问题。

官方脚本添加这个设计的初衷显然是为了自动补全。排查中也发现 Dolphin 能够正常识别 MIME 类型，说明不是 MIME 的问题，而应该是 Application 关联的问题。

于是我开始 debug Dolphin，发现日志如下：

```log
[2.341 debug kf.service.services]
query for mimeType "application/zip" returning 0 offers
```

应用关联是由 KService / KSycoca 提供的，因此推断是 KService 出现了问题。
KSycoca 依赖 `$XDG_DATA_DIRS` 建立缓存，Nix 添加了新路径后可能会导致其尝试读取不同的缓存文件：

```log
Opening ksycoca from
"/home/dragonren/.cache/ksycoca6_en_o72+Pq+2OmLMTz2+ouIXYbB7LU8="
```

因此，极大概率是切换 `$XDG_DATA_DIRS` 导致了原缓存失效。

# 解决问题
执行以下命令重构缓存：
```shell
kbuildsycoca6 --noincremental
```

- 如果环境经常变动或缓存频繁失效，可以考虑配置 cron 定时任务或 systemd timer。
- 也可以将其直接加入到 Hyprland 的自启配置（`exec-once`）中。

问题解决。
