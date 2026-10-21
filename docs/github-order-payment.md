# 将订单功能提交到团队 GitHub

远程仓库：https://github.com/lonelyhty/hebut-xiecheng-se24 。功能分支：`codex/order-payment-cancel`。以下命令在 PowerShell 运行。

## 本地验证

```powershell
Set-Location D:/software_test/hebut-xiecheng-se24
git branch --show-current
npm test
npm start
```

打开 http://127.0.0.1:5180/ ，用有效演示手机号和验证码 `888888` 登录。提交订单后可选立即支付、稍后付款、取消订单；在我的订单里检查待付款、已支付、已取消筛选。服务运行时另开终端操作 Git。

## 保存功能提交

如果助手已经完成本地提交，用 `git log -1 --oneline` 查看，跳过下面 add 和 commit。否则执行：

```powershell
git add public/app.js public/local-orders.js public/platform.css tests/local-orders.test.mjs README.md docs/github-order-payment.md
git diff --cached --stat
git commit -m "feat: support pending payment and order cancellation"
```

明确列出文件，避免把已有的未跟踪课程图表、压缩包一起加入。

## 有团队仓库写权限

```powershell
git push -u origin codex/order-payment-cancel
```

首次推送可能需要浏览器登录 GitHub。完成后打开：

https://github.com/lonelyhty/hebut-xiecheng-se24/compare/main...codex/order-payment-cancel

点击 **Create pull request**，base 选 `main`，compare 选 `codex/order-payment-cancel`。标题可用「feat: 补全待付款、模拟支付与取消订单」。描述填写新增功能、18 项自动化测试通过，以及浏览器验证的下单、稍后付款、刷新保存、支付和取消流程。提交后由 leader 审核合并。推送分支不会自动合并到 main。

## 没有团队仓库写权限

若推送提示 403 或 Permission denied，先确认登录账号。没有写权限时，在 leader 仓库页面点击 **Fork** 创建到自己账号，然后执行（替换 YOUR_GITHUB_USERNAME）：

```powershell
git remote add myfork https://github.com/YOUR_GITHUB_USERNAME/hebut-xiecheng-se24.git
git push -u myfork codex/order-payment-cancel
```

在自己的 Fork 页面点击 **Contribute → Open pull request**。base repository 选 `lonelyhty/hebut-xiecheng-se24`，base 选 `main`；head repository 选自己的 Fork，compare 选功能分支，再创建 PR。如果 myfork 已存在，先用 `git remote -v` 确认地址。

## 后续补改

继续在同一分支修改、运行测试、提交，再执行 `git push`，原 PR 会自动更新。
