import { TranslationKeys } from "./en";

export const zh: TranslationKeys = {
  nav: {
    start: "起始",
    blog: "博客",
    tools: "工具",
    settings: "设置",
    account: "用户中心",
  },
  home: {
    title: "jadren - 起始",
    description: "小龙小窝",
  },
  blogPortal: {
    title: "小龙小窝",
    description:
      "基于 Next.js 构建的个人博客，支持 Markdown 与 LaTeX、代码高亮、以及双语内容。",
    features: [
      "Markdown 与 LaTeX",
      "代码高亮",
      "深色 / 浅色主题",
      "全文搜索",
    ],
    visit: "访问博客",
  },
  theme: {
    toggle: "切换主题",
  },
  settings: {
    title: "设置", description: "管理仅保存在当前浏览器中的本地偏好。",
    automatic: "自动（日出与日落）", system: "跟随系统", manual: "手动",
    location: "位置", locationHelp: "输入经纬度、使用网站定位，或通过本次请求的 IP 估算位置。",
    latitude: "纬度", longitude: "经度", save: "保存经纬度", useLocation: "使用网站定位", useIp: "使用当前 IP", source: "位置来源",
    sources: { manual: "手动输入", geolocation: "网站定位", ip: "当前 IP" },
    saved: "位置已保存，并已计算今天的日出与日落。", invalid: "请输入有效的经纬度。", locationFailed: "无法获取位置，请检查本站位置权限。", ipFailed: "无法通过当前 IP 获取经纬度。",
    solar: "今天：日出 {sunrise}，日落 {sunset}。明天将重新计算。",
    llm: {
      title: "LLM API", subtitle: "本地 API 配置", profile: "配置", name: "名称", renameHint: "双击修改名称", type: "API 类型", token: "API Token", url: "接入 URL", urlHelp: "可填写服务根地址或完整 API 地址", actualEndpoint: "实际请求地址", add: "添加 Profile", save: "保存配置", delete: "删除配置", empty: "还没有 API Profile。", saved: "Profile 已保存到本地。",
      privacy: "凭证只会保存在当前浏览器的 localStorage 中。本项目完全开源，不会上传或窃取你的凭证。",
      unsaved: "设置尚未保存，确定要离开此页面吗？",
      providerList: "Provider List", modelList: "Model List", provider: "绑定 Provider", model: "模型", modelId: "Model ID", addModel: "添加模型", deleteModel: "删除模型", emptyModels: "还没有模型。", providerRequired: "请先添加一个 Provider，再创建模型。",
    },
  },
  stylizedName: {
    part1: "小龙",
    part2: "小窝",
  },
  toolPortal: {
    title: "在线工具",
    description:
      "实用在线工具集合 — Base64 编解码，更多工具正在路上。",
    features: [
      "Base64 编解码",
      "快速且可离线使用",
      "深色 / 浅色主题",
      "更多工具即将到来",
    ],
    visit: "访问工具",
  },
  footer: {
    copyright: "jadren",
    email: "jaden@jadren.moe",
    github: "GitHub",
    beian: "豫ICP备2023022865号",
  },
};
