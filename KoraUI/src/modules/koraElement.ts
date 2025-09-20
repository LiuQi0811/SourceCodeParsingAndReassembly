window.KoraUI.definitionModule("koraJS", function (exports: Function) {
    "use strict";
    const koraUI = window.KoraUI;
    koraUI.prompt(); // prompt 通用提示
    koraUI.equipmentInformation(); // equipmentInformation 设备信息
    const MODULE_NAME: string = "koraElement";

    class Element {
        config: object;

        constructor() {
            this.config = {};
        }

        set() {
            alert("设置");
        }

        on() {
            console.warn("事件");
        }

        tab() {
            console.warn("标签选项卡");
        }

        insertTab() {
            console.warn("新增标签选项卡");
        }

        removeTab() {
            console.warn("移除标签选项卡");
        }

        changeTab() {
            console.warn("切换标签选项卡");
        }

        progress() {
            console.warn("进度条");
        }

        initialize(type?: any, filter?: any) {
            const elementFilter = function () {
                return (typeof filter === "string" && filter) ? ('[koraUI-filter="' + filter + '"]') : "";
            }();
            const resultItem: any = {
                /**
                 * Tab 选项卡
                 *
                 */
                tab: function (element: any) {
                    const KORA_UI_TAB = ".koraUI-tab";
                    console.warn(" TAB", element,KORA_UI_TAB);
                },
                nav: function () {
                    console.warn("NAV");
                },
                breadcrumb: function () {
                    console.warn("BREADCRUMB");
                },
                progress: function () {
                    console.warn("PROGRESS");
                },
                collapse: function () {
                    console.warn("COLLAPSE");
                }
            };
            return resultItem[type] ? resultItem[type]() : koraUI.traverseEach(resultItem, function (indexKey: string, fnValue: any) {
                fnValue();
            });
        }

        /**
         * render 渲染器
         * @author LiuQi
         */
        render() {
            // initialize 初始化
            this.initialize();
        }
    }

    const element = new Element();
    if (document.readyState === "loading") {
        // 如果 DOM 还在加载中，才监听
        document.addEventListener("DOMContentLoaded", () => {
            element.render();
        });
    } else {
        // 如果 DOM 已经加载好了，直接调用
        element.render();
    }
    window.addEventListener("resize", function () {
        alert(" 自适应");
    });
    exports(MODULE_NAME, element);
});