import type { RelativePathString } from 'expo-router';
// IconFamily type definition for various icon libraries used in the application.
export type IconFamily = "AntDesign" | "Entypo" | "EvilIcons" | "Feather" | "FontAwesome" | "FontAwesome5" | "Fontisto" | "Foundation" | "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons" | "Octicons" | "SimpleLineIcons" | "Zocial" | "FontAwesome6";

/**
 * AppMenuItem interface defines the structure of each menu item in the application menu.
 * @author LiuQi
 */
export interface AppMenuItem {
    routerKey: RelativePathString | string;
    title: string;
    family: IconFamily;
    icon: string;
    size: number;
    color: string;
    hideNav: boolean;
}

/**
 * APP_MENU_CONFIG is an array of AppMenuItem objects that defines the configuration for the application menu.
 * @author LiuQi
 */
export const APP_MENU_CONFIG: AppMenuItem[] = [
    {
        routerKey: "/stopwatch/main",
        title: "秒表计时器",
        family: "FontAwesome6",
        icon: "stopwatch",
        size: 30,
        color: "#000000",
        hideNav: false
    },
    {
        routerKey: "/weather/main",
        title: "天气",
        family: "MaterialCommunityIcons",
        icon: "weather-cloudy",
        size: 30,
        color: "#000000",
        hideNav: false
    },
    {
        routerKey: "/twitter-entrance-animation",
        title: "推特",
        family: "FontAwesome6",
        icon: "x-twitter",
        size: 30,
        color: "#000000",
        hideNav: false
    },
    {
        routerKey: "/beautiful-day",
        title: "美好的一天",
        family: "FontAwesome6",
        icon: "sun",
        size: 30,
        color: "#000000",
        hideNav: false
    }
];