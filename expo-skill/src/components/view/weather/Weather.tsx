import Util from '@/common/Util';
import UniversalIcon from '@/components/UniversalIcon';
import type { IconFamily } from '@/config/appMenuConfig';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ImageRequireSource, ScrollView, StatusBar, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import Swiper from 'react-native-swiper';

/**
 * WeatherDataProps 单页天气数据类型定义
 * @author LiuQi
 */
interface WeatherDataProps {
    key: number,                // 唯一标识
    city: string,               // 城市名称
    night: boolean,             // 是否夜间模式
    bg: ImageRequireSource,     // 背景图片
    abs: string,                // 天气简述
    degree: number,             // 当前温度
    today: {                    // 今日概览信息
        week: string,           // 星期
        day: string,            // 描述(今天)
        high: number,           // 今日最高温
        low: number             // 今日最低温
    }
    hours: {                    // 逐小时预报数组
        key: number,
        time: string,           // 时刻文本
        icon: string,          // 图标名称
        degree: string,        // 温度文本
        color: string          // 文字/图标颜色
    }[],
    days: {                     // 多日预报数组
        key: number,
        day: string,           // 日期/星期文本
        icon: string,          // 图标名称
        high: number,          // 最高温
        low: number            // 最低温
    }[],
    info: string,               // 今日天气详情描述
    rise: string,               // 日出时间
    down: string,               // 日落时间
    prop: string,               // 降雨概率
    humi: string,               // 湿度
    dir: string,                // 风向
    speed: string,              // 风速
    feel: string,               // 体感温度
    rain: string,               // 降水量
    pres: string,               // 气压
    sight: string,              // 能见度
    uv: string                  // 紫外线指数
}

/**
 * Weather 天气页面主组件
 * @returns JSX元素
 * @author LiuQi
 */
export default function Weather() {
    const router = useRouter();
    const iconFamily: IconFamily = "MaterialCommunityIcons"; // 图标字体库
    // 模拟城市天气数据
    const [weatherData] = useState<WeatherDataProps[]>([
        {
            key: 0,
            city: "福州",
            night: true,
            bg: require("../../../../assets/images/w_.png"),
            abs: "大部晴朗",
            degree: 15,
            today: {
                week: "星期六",
                day: "今天",
                high: 16,
                low: 14
            },
            hours: [
                { key: 101, time: "现在", icon: "moon-full", degree: "15°", color: "rgba(255,255,255,1)" },
                { key: 102, time: "3时", icon: "weather-cloudy", degree: "15°", color: "rgba(255,255,255,0.8)" },
                { key: 103, time: "4时", icon: "weather-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 104, time: "5时", icon: "weather-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 105, time: "6时", icon: "weather-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 106, time: "06:21", icon: "white-balance-sunny", degree: "日出", color: "#fedf32" },
                { key: 107, time: "7时", icon: "white-balance-sunny", degree: "16°", color: "rgba(255,255,255,0.9)" },
                { key: 108, time: "8时", icon: "white-balance-sunny", degree: "18°", color: "rgba(255,255,255,0.9)" },
                { key: 109, time: "9时", icon: "white-balance-sunny", degree: "19°", color: "#fedf32" },
                { key: 110, time: "10时", icon: "white-balance-sunny", degree: "22°", color: "#fedf32" },
                { key: 111, time: "11时", icon: "white-balance-sunny", degree: "23°", color: "#fedf32" },
                { key: 112, time: "13时", icon: "white-balance-sunny", degree: "22°", color: "#fedf32" },
                { key: 113, time: "13时", icon: "white-balance-sunny", degree: "22°", color: "#fedf32" },
                { key: 114, time: "14时", icon: "white-balance-sunny", degree: "16°", color: "rgba(255,255,255,0.9)" },
                { key: 115, time: "15时", icon: "white-balance-sunny", degree: "22°", color: "rgba(255,255,255,0.9)" },
                { key: 116, time: "16时", icon: "white-balance-sunny", degree: "21°", color: "rgba(255,255,255,0.9)" },
                { key: 117, time: "17时", icon: "white-balance-sunny", degree: "19°", color: "rgba(255,255,255,0.9)" },
                { key: 118, time: "18时", icon: "white-balance-sunny", degree: "18°", color: "rgba(255,255,255,0.9)" },
                { key: 119, time: "18:06", icon: "white-balance-sunny", degree: "日落", color: "rgba(255,255,255,0.9)" },
                { key: 120, time: "19时", icon: "white-balance-sunny", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 121, time: "20时", icon: "white-balance-sunny", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 122, time: "21时", icon: "weather-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 123, time: "22时", icon: "weather-partly-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 124, time: "23时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 125, time: "0时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 126, time: "1时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 127, time: "2时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" }
            ],
            days: [
                { key: 21, day: "星期一", icon: "weather-partly-cloudy", high: 21, low: 16 },
                { key: 22, day: "星期二", icon: "weather-rainy", high: 22, low: 14 },
                { key: 23, day: "星期三", icon: "weather-rainy", high: 21, low: 11 },
                { key: 24, day: "星期四", icon: "weather-rainy", high: 12, low: 8 },
                { key: 25, day: "星期五", icon: "weather-rainy", high: 9, low: 7 },
                { key: 26, day: "星期六", icon: "weather-partly-cloudy", high: 13, low: 9 },
                { key: 27, day: "星期日", icon: "weather-rainy", high: 17, low: 13 },
                { key: 28, day: "星期一", icon: "weather-partly-cloudy", high: 18, low: 14 },
                { key: 29, day: "星期二", icon: "weather-partly-cloudy", high: 22, low: 17 }
            ],
            info: "今天：今天大部多云。现在气温 15°；最高气温23°。",
            rise: "06:21",
            down: "18:06",
            prop: "10%",
            humi: "94%",
            dir: "东北偏北",
            speed: "3千米/小时",
            feel: "15°",
            rain: "0.0 毫米",
            pres: "1,016 百帕",
            sight: "5.0 公里",
            uv: "0"
        },
        {
            key: 1,
            city: "卡尔加里",
            night: false,
            bg: require("../../../../assets/images/w.png"),
            abs: "大部晴朗",
            degree: 15,
            today: {
                week: "星期六",
                day: "今天",
                high: 16,
                low: 14
            },
            hours: [
                { key: 101, time: "现在", icon: "moon-full", degree: "15°", color: "rgba(255,255,255,1)" },
                { key: 102, time: "3时", icon: "weather-night-partly-cloudy", degree: "15°", color: "rgba(255,255,255,0.8)" },
                { key: 103, time: "4时", icon: "weather-night-partly-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 104, time: "5时", icon: "weather-night-partly-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 105, time: "6时", icon: "weather-night-partly-cloudy", degree: "16°", color: "rgba(255,255,255,0.8)" },
                { key: 106, time: "06:21", icon: "white-balance-sunny", degree: "日出", color: "#fedf32" },
                { key: 107, time: "7时", icon: "weather-partly-cloudy", degree: "16°", color: "rgba(255,255,255,0.9)" },
                { key: 108, time: "8时", icon: "weather-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.9)" },
                { key: 109, time: "9时", icon: "weather-sunny", degree: "19°", color: "#fedf32" },
                { key: 110, time: "10时", icon: "weather-sunny", degree: "22°", color: "#fedf32" },
                { key: 111, time: "11时", icon: "weather-sunny", degree: "23°", color: "#fedf32" },
                { key: 112, time: "13时", icon: "weather-sunny", degree: "22°", color: "#fedf32" },
                { key: 113, time: "13时", icon: "weather-sunny", degree: "22°", color: "#fedf32" },
                { key: 114, time: "14时", icon: "weather-partly-cloudy", degree: "16°", color: "rgba(255,255,255,0.9)" },
                { key: 115, time: "15时", icon: "weather-partly-cloudy", degree: "22°", color: "rgba(255,255,255,0.9)" },
                { key: 116, time: "16时", icon: "weather-partly-cloudy", degree: "21°", color: "rgba(255,255,255,0.9)" },
                { key: 117, time: "17时", icon: "weather-partly-cloudy", degree: "19°", color: "rgba(255,255,255,0.9)" },
                { key: 118, time: "18时", icon: "weather-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.9)" },
                { key: 119, time: "18:06", icon: "weather-partly-cloudy-outline", degree: "日落", color: "rgba(255,255,255,0.9)" },
                { key: 120, time: "19时", icon: "weather-night-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 121, time: "20时", icon: "weather-night-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 122, time: "21时", icon: "weather-night-partly-cloudy", degree: "18°", color: "rgba(255,255,255,0.8)" },
                { key: 123, time: "22时", icon: "weather-night-partly-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 124, time: "23时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 125, time: "0时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 126, time: "1时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" },
                { key: 127, time: "2时", icon: "weather-cloudy", degree: "17°", color: "rgba(255,255,255,0.8)" }
            ],
            days: [
                { key: 21, day: "星期一", icon: "weather-partly-cloudy", high: 21, low: 16 },
                { key: 22, day: "星期二", icon: "weather-rainy", high: 22, low: 14 },
                { key: 23, day: "星期三", icon: "weather-rainy", high: 21, low: 11 },
                { key: 24, day: "星期四", icon: "weather-rainy", high: 12, low: 8 },
                { key: 25, day: "星期五", icon: "weather-rainy", high: 9, low: 7 },
                { key: 26, day: "星期六", icon: "weather-partly-cloudy", high: 13, low: 9 },
                { key: 27, day: "星期日", icon: "weather-rainy", high: 17, low: 13 },
                { key: 28, day: "星期一", icon: "weather-partly-cloudy", high: 18, low: 14 },
                { key: 29, day: "星期二", icon: "weather-partly-cloudy", high: 22, low: 17 }
            ],
            info: "今天：今天大部多云。现在气温 15°；最高气温23°。",
            rise: "06:21",
            down: "18:06",
            prop: "10%",
            humi: "94%",
            dir: "东北偏北",
            speed: "3千米/小时",
            feel: "15°",
            rain: "0.0 毫米",
            pres: "1,016 百帕",
            sight: "5.0 公里",
            uv: "0"
        }
    ]);

    // 状态栏样式设置
    useEffect(() => {
        StatusBar.setBarStyle("light-content");
        return () => {
            StatusBar.setBarStyle("dark-content");
        };
    }, []);

    // 返回按钮点击事件
    const handleBackPress = () => {
        router.back();
        StatusBar.setBarStyle("dark-content");
    };

    // 生成每一页轮播页面
    const slides: React.JSX.Element[] = weatherData.map((element) => {
        // 逐小时预报布局
        const hourView = element.hours.map((hourElement, hourIndex) => {
            return (
                <View key={hourElement.key} style={styles.withinDayHoursBox}>
                    <Text style={hourIndex === 0 ? styles.withinDayHoursTimeBold : styles.withinDayHoursTime}>
                        {hourElement.time}
                    </Text>
                    <UniversalIcon
                        style={[styles.withinDayHoursIcon, { color: hourElement.color }]}
                        size={25}
                        family={iconFamily}
                        iconName={hourElement.icon}
                    />
                    <Text style={hourIndex === 0 ? styles.withinDayHoursDegreeBold : styles.withinDayHoursDegree}>
                        {hourElement.degree}
                    </Text>
                </View>
            );
        });

        // 7日/多日预报布局
        const dayView = element.days.map((dayElement) => {
            return (
                <View key={dayElement.key} style={styles.withinWeekLine}>
                    <View style={styles.withinWeekDay}>
                        <Text style={styles.withinWeekDayText}>{dayElement.day}</Text>
                    </View>
                    <View style={styles.withinWeekIcon}>
                        <UniversalIcon
                            iconName={dayElement.icon}
                            family={iconFamily}
                            style={styles.withinWeekIconIcon}
                            size={25}
                        />
                    </View>
                    <View style={styles.withinWeekDegree}>
                        <Text style={styles.withinWeekHigh}>{dayElement.high}</Text>
                        <Text style={element.night ? styles.withinWeekLowNight : styles.withinWeekLow}>
                            {dayElement.low}
                        </Text>
                    </View>
                </View>
            );
        });

        return (
            <View key={element.key} style={{ flex: 1 }}>
                {/* 背景底图 */}
                <Image
                    source={element.bg}
                    resizeMode="cover"
                    style={StyleSheet.absoluteFill}
                />
                <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={false}>
                    {/* 头部城市、温度信息 */}
                    <View style={styles.headInfo}>
                        <Text style={styles.city}>{element.city}</Text>
                        <Text style={styles.abs}>{element.abs}</Text>
                        <View style={styles.degreeWrap}>
                            <Text style={styles.degreeNum}>{element.degree}</Text>
                            <Text style={styles.degreeSymbol}>°</Text>
                        </View>
                    </View>

                    <View style={styles.contentContainer}>
                        {/* 今日概览栏：星期/最高最低温 */}
                        <View style={styles.withinDayGeneral}>
                            <View style={styles.withinDayHead}>
                                <Text style={styles.withinDayWeek}>{element.today.week}</Text>
                                <Text style={styles.withinDayDay}>{element.today.day}</Text>
                            </View>
                            <View style={styles.withinDayTail}>
                                <Text style={styles.withinDayHigh}>{element.today.high}°</Text>
                                <Text style={element.night ? styles.withinDayLowNight : styles.withinDayLow}>
                                    {element.today.low}°
                                </Text>
                            </View>
                        </View>

                        {/* 逐小时横向滚动预报 */}
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.withinDayHoursContainer}>
                            <View style={styles.withinDayHours}>
                                {hourView}
                            </View>
                        </ScrollView>

                        {/* 多日预报区域 */}
                        <View style={styles.withinWeek}>
                            {dayView}
                        </View>

                        {/* 今日天气详情文案 */}
                        <View style={styles.weatherInfo}>
                            <Text style={styles.weatherInfoText}>{element.info}</Text>
                        </View>

                        {/* 详细气象信息：日出日落、湿度、风速等 */}
                        <View style={styles.weatherOther}>
                            <View style={styles.weatherOtherSection}>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>日出：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.rise}</Text>
                                </View>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>日落：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.down}</Text>
                                </View>
                            </View>
                            <View style={styles.weatherOtherSection}>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>降雨概率：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.prop}</Text>
                                </View>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>湿度：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.humi}</Text>
                                </View>
                            </View>
                            <View style={styles.weatherOtherSection}>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>风速：</Text>
                                    <Text style={styles.weatherOtherValue}>
                                        <Text style={{ fontSize: 12, opacity: 0.7 }}>{element.dir}</Text> {element.speed}
                                    </Text>
                                </View>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>体感温度：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.feel}</Text>
                                </View>
                            </View>
                            <View style={styles.weatherOtherSection}>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>降水量：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.rain}</Text>
                                </View>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>气压：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.pres}</Text>
                                </View>
                            </View>
                            <View style={styles.weatherOtherSection}>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>能见度：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.sight}</Text>
                                </View>
                                <View style={styles.weatherOtherLine}>
                                    <Text style={styles.weatherOtherTitle}>紫外线指数：</Text>
                                    <Text style={styles.weatherOtherValue}>{element.uv}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    });

    return (
        <View style={{ flex: 1 }}>
            {/* 城市轮播组件 */}
            <Swiper
                showsButtons={false}
                paginationStyle={styles.swiperPagination}
                dot={<View style={styles.swiperDot} />}
                activeDot={<View style={styles.swiperActiveDot} />}
            >
                {slides}
            </Swiper>
            {/* 返回按钮 */}
            <TouchableHighlight style={styles.backButton} onPress={handleBackPress} underlayColor="rgba(255,255,255,0.2)">
                <UniversalIcon family="Ionicons" iconName="list-outline" size={20} style={styles.backButtonIcon} />
            </TouchableHighlight>
        </View>
    );
}

/**
 * 全局样式
 */
const styles = StyleSheet.create({
    // 滚动页面容器
    pageContainer: {
        backgroundColor: "transparent",
        position: "absolute",
        width: Util.size.width,
        left: 0,
        top: 40,
        height: Util.size.height - 70,
        paddingHorizontal: 16
    },
    // 头部信息区域
    headInfo: {
        paddingTop: 40,
        alignItems: "center",
        paddingBottom: 40
    },
    // 城市名称
    city: {
        fontSize: 28,
        color: "#fff",
        paddingBottom: 8,
        backgroundColor: "transparent",
        fontWeight: "500"
    },
    // 天气简述
    abs: {
        fontSize: 17,
        color: "#fff",
        backgroundColor: "transparent",
        marginBottom: 12
    },
    // 温度整体容器
    degreeWrap: {
        flexDirection: "row",
        alignItems: "flex-start"
    },
    // 温度数字
    degreeNum: {
        fontSize: 90,
        color: "#fff",
        fontWeight: "100",
        lineHeight: 90
    },
    // 温度符号 °
    degreeSymbol: {
        fontSize: 36,
        color: "#fff",
        fontWeight: "300",
        marginTop: 6
    },
    // 主体内容容器
    contentContainer: {
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 12
    },
    // 今日概览行
    withinDayGeneral: {
        flexDirection: "row",
        width: "100%",
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomColor: "rgba(255,255,255,0.3)",
        borderBottomWidth: Util.pixel
    },
    withinDayHead: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center"
    },
    withinDayTail: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center"
    },
    withinDayWeek: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "400",
        marginRight: 8
    },
    withinDayDay: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "300"
    },
    withinDayHigh: {
        fontSize: 17,
        color: "#fff",
        fontWeight: "400",
        width: 40,
        textAlign: "right"
    },
    withinDayLowNight: {
        fontSize: 17,
        color: "#bbbbbb",
        fontWeight: "300",
        width: 40,
        textAlign: "right"
    },
    withinDayLow: {
        fontSize: 17,
        color: "#eeeeee",
        fontWeight: "300",
        width: 40,
        textAlign: "right"
    },
    // 逐小时容器
    withinDayHoursContainer: {
        marginBottom: 12,
        borderTopColor: "rgba(255,255,255,0.3)",
        borderTopWidth: Util.pixel,
        borderBottomColor: "rgba(255,255,255,0.3)",
        borderBottomWidth: Util.pixel
    },
    withinDayHours: {
        paddingVertical: 12,
        paddingHorizontal: 4,
        flexDirection: "row",
        flexWrap: "nowrap"
    },
    // 逐小时单个单元格
    withinDayHoursBox: {
        width: 56,
        alignItems: "center"
    },
    withinDayHoursTimeBold: {
        color: "#fff",
        fontSize: 13,
        textAlign: "center",
        fontWeight: "600"
    },
    withinDayHoursTime: {
        color: "#fff",
        fontSize: 12,
        textAlign: "center",
        opacity: 0.9
    },
    withinDayHoursIcon: {
        textAlign: "center",
        paddingVertical: 6
    },
    withinDayHoursDegreeBold: {
        color: "#fff",
        fontSize: 15,
        textAlign: "center",
        fontWeight: "600"
    },
    withinDayHoursDegree: {
        color: "#fff",
        fontSize: 14,
        textAlign: "center",
        opacity: 0.9
    },
    // 多日预报区域
    withinWeek: {
        paddingVertical: 8
    },
    withinWeekLine: {
        flexDirection: "row",
        height: 36,
        alignItems: "center"
    },
    withinWeekDay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "flex-start"
    },
    withinWeekDayText: {
        color: "#fff",
        paddingLeft: 8,
        fontSize: 15
    },
    withinWeekIcon: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    withinWeekIconIcon: {
        color: "#fff"
    },
    withinWeekDegree: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center"
    },
    withinWeekHigh: {
        color: "#fff",
        width: 40,
        fontSize: 16,
        textAlign: "right"
    },
    withinWeekLowNight: {
        color: "#aaa",
        width: 40,
        fontSize: 16,
        textAlign: "right"
    },
    withinWeekLow: {
        color: "#eee",
        width: 40,
        fontSize: 16,
        textAlign: "right"
    },
    // 天气信息描述栏
    weatherInfo: {
        marginTop: 8,
        borderTopColor: "rgba(255,255,255,0.3)",
        borderTopWidth: Util.pixel,
        borderBottomColor: "rgba(255,255,255,0.3)",
        borderBottomWidth: Util.pixel
    },
    weatherInfoText: {
        color: "#fff",
        fontSize: 15,
        paddingVertical: 12,
        paddingHorizontal: 8
    },
    // 详细气象信息
    weatherOther: {
        paddingTop: 10
    },
    weatherOtherSection: {
        paddingBottom: 12
    },
    weatherOtherLine: {
        flexDirection: "row",
        flexWrap: "nowrap",
        marginVertical: 4
    },
    weatherOtherTitle: {
        width: Util.size.width / 2 - 20,
        color: "#fff",
        textAlign: "right",
        fontSize: 15,
        opacity: 0.85
    },
    weatherOtherValue: {
        flex: 1,
        paddingLeft: 16,
        fontSize: 15,
        color: "#fff"
    },
    // 返回按钮
    backButton: {
        position: "absolute",
        right: 24,
        bottom: 24,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.3)",
        justifyContent: "center",
        alignItems: "center"
    },
    backButtonIcon: {
        color: "#fff"
    },
    // 轮播指示器
    swiperPagination: {
        bottom: 16,
        paddingTop: 10,
        paddingBottom: 6
    },
    swiperDot: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        width: 7,
        height: 7,
        borderRadius: 4,
        marginHorizontal: 4
    },
    swiperActiveDot: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        width: 7,
        height: 7,
        borderRadius: 4,
        marginHorizontal: 4
    }
});