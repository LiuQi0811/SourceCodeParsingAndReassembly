import React from 'react';
import ReactDOM from 'react-dom/client';


const Root = (<h1>345000000</h1>);


// 获取html中id="root"的DOM容器，创建React根实例并渲染内容
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    // 环境判断：开发环境开启严格模式，生产环境关闭
    process.env.NODE_ENV === "development" ? <React.StrictMode>{Root}</React.StrictMode> : Root
);