---
title: Markdown 功能测试
description: 全面测试所有 markdown 功能
tags:
  - Markdown
  - 测试
date: '2026-06-16T11:45:48.864Z'
---

## 1. 标题测试

# H1 标题
## H2 标题
### H3 标题
#### H4 标题
##### H5 标题
###### H6 标题

---

## 2. 强调测试

**粗体文本**
*斜体文本*
***粗体加斜体***
~~删除线文本~~

---

## 3. 列表测试

### 无序列表
- 项目一
- 项目二
  - 嵌套项目 2.1
  - 嵌套项目 2.2
- 项目三

### 有序列表jdflkjlsjfl;djdklsjiol;sdjflk;sdjflk;ajsdklf;jsakl;fjikl;dsfjkl;
1. 第一项
2. 第二项
3. 第三项
   1. 嵌套第一项
   2. 嵌套第二项

### 任务列表
- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个未完成任务

---

## 4. 链接测试

[百度](https://www.baidu.com)
[本地文件链接](./README.md)

---

## 5. 图片测试

![替代文本](https://via.placeholder.com/150)

---

## 6. 代码测试

### 行内代码
这是 `行内代码` 示例。

### 代码块
```javascript
function hello() {
  console.log("Hello, World!");
}
```

### 代码块（带语言标识）
```python
def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
```

---

## 7. 表格测试

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A1  | B1  | C1  |
| A2  | B2  | C2  |
| A3  | B3  | C3  |

| 左对齐 | 居中 | 右对齐 |
|:-------|:----:|------:|
| 文本   | 文本 |  文本 |
| 文本   | 文本 |  文本 |

---

## 8. 引用测试

> 这是引用文本
> 可以有多行

> 多级引用
>> 嵌套引用
>>> 多层嵌套引用

---

## 9. 水平线

---
***
___

---

## 10. 脚注测试

这是一段带有脚注的文本[^1]。

[^1]: 这是脚注内容。

---

## 11. Emoji 表情

:smile: :rocket: :+1: :heart:

---

## 12. 自动链接

https://www.example.com

email@example.com

---

## 13. 转义字符

\*星号\*  
\*\*双星号\*\*  
\`反引号\`

---

## 14. 复杂嵌套

> **引用中的粗体**
> - 列表项 1
> - 列表项 2
>   ```javascript
>   // 引用中的代码块
>   const x = 1;
>   ```

---

## 15. 彩虹文字

<span style="color:red">红</span><span style="color:orange">橙</span><span style="color:yellow">黄</span><span style="color:green">绿</span><span style="color:blue">蓝</span><span style="color:indigo">靛</span><span style="color:violet">紫</span>
