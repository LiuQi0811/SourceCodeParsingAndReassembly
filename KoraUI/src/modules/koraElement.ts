window.KoraUI.definitionModule("koraJS", function (exports: Function) {
    "use strict";
    const koraUI = (window as any).KoraUI;
    const _K = koraUI.K;
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
                    const targetElement= element || _K(KORA_UI_TAB + elementFilter);
                    console.log(" TAR ", targetElement)
                    callCommand.tabAutomatic.call({},null,targetElement);
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

    let callCommand = {
        tabClick: function (){
            alert(" tabClick ");
        },
        tabAutomatic: function (spread: any,element:any){
            _K("a");
            const targetElement = element || _K(".koraUI-tab");
            targetElement.koraEach(function (el: HTMLElement){
                const _this = _K(el);
                const tabTitle = _this.koraChildren(".koraUI-tab-title");
            });
        }
    };

    const element = new Element();
    _K(function (){
        element.render()
    });
    window.addEventListener("resize", function () {
        alert(" 自适应");
    });
    exports(MODULE_NAME, element);
});