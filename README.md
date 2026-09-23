# Venera-Next 漫蛙漫画源

这是适用于 [Venera-Next](https://github.com/CyrilPeng/Venera-Next) 的第三方 JavaScript 漫画源，适配 `manwa.me` 的分类、搜索、详情、章节和图片加载接口。

## 安装

在 Venera-Next 打开「漫画源 → 源仓库 → 添加仓库」，填写以下地址：

```text
https://raw.githubusercontent.com/shixuit/venera-next-manwa-me-source/main/index.json
```

保存后，在「浏览漫画源」中安装「漫蛙漫画」。也可以在「已安装 → 通过链接安装」中填写：

```text
https://cdn.jsdelivr.net/gh/shixuit/venera-next-manwa-me-source@main/manwa_me.js
```

## 使用说明

- 源预置“最近更新”“韩国 BL”“韩国漫画”入口；“韩国 BL”对应站点的 `gender=0&area=2` 筛选。
- 分类页支持标签、受众、地区、连载状态和排序筛选。
- 如果加载提示 Cloudflare 验证，在该源的账号设置中点击「登录」，使用内置浏览器完成验证；也可以手动填写浏览器中的 `cf_clearance` Cookie。
- 站点会更换域名。可在该源的“站点地址”设置中以英文逗号填写多个地址，首个为优先地址。

## 免责声明

本仓库只提供阅读器适配脚本，不托管漫画内容，也不保证第三方站点、链接或版权状态。请遵守当地法律、站点条款和版权要求。
