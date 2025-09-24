### 安装 TypeScript 编译器
`npm install -g typescript`
### 输入下面的命令查看当前 TypeScript 编译器的版本：
`tsc --v`
### 全局安装 ts-node 模块
`npm install -g ts-node`
### 配置 TypeScript 编译器
`创建 tsconfig.json 文件： tsc --init`
### nodemon 模块允许你在修改了 JavaScript 源代码后，重新启动应用程序
### 安装 nodemon 和 concurrently 模块 -g 标识表示 npm 将会全局安装这两个模块，你可以在其他项目中使用它们
`npm install --g nodemon concurrently`

#### "start:build": "tsc -w" 会监听 ./src 下的文件的变化，当有文件发生变化的时候，重新编译这些文件。
#### "start:run": "nodemon build/app.js" 每当有新文件产生的时候，重新运行 ./build 目录下的 app.js 文件。
#### "start": "concurrently npm:start:*" 运行所有 npm:start:* 开头的命令，它会执行上面的 start:build 和 start:run 命令。
#### 因为 main.js 是 Node.js 程序的入口，还需要把 package.json 文件中的 main 配置修改成 main.js，