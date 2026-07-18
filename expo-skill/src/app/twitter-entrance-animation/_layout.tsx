import Util from '@/common/Util';
import UniversalIcon from '@/components/UniversalIcon';
import MainView from '@/components/view/twitter-entrance-animation/App';
import { usePageHeader } from '@/hooks/usePageHeader';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
export default function TwitterLayout() {
    usePageHeader();
    return (<View style={styles.container}>
        <Tabs screenOptions={({ route }) => ({
            tabBarActiveTintColor: "#1b95e0",
            tabBarInactiveTintColor: "gray",
            tabBarStyle: { backgroundColor: "#fff" },
            headerShown: false,
            // 用tabBarLabel替代title，手动包裹<Text>
            tabBarLabel: ({ focused }) => {
                const labelMap: Record<string, string> = {
                    index: "首页",
                    notifications: "通知",
                    messages: "私信",
                    profile: "我"
                };
                return (
                    <Text style={{ color: focused ? "#1b95e0" : "gray" }}>
                        {labelMap[route.name]}
                    </Text>
                );
            },
            tabBarIcon: ({ focused, color, size }) => {
                let iconName: string = "";
                switch (route.name) {
                    case "index": iconName = focused ? "home" : "home-outline";
                        break;
                    case "notifications": iconName = focused ? "notifications-circle" : "notifications-circle-outline";
                        break;
                    case "messages": iconName = focused ? "chatbox-sharp" : "chatbox-outline";
                        break;
                    case "profile": iconName = focused ? "person-circle" : "person-circle-outline";
                        break;
                    default: iconName = "home-outline";
                }
                return <UniversalIcon family="Ionicons" iconName={iconName as any} size={size} color={color} />;
            }
        })}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="notifications" />
            <Tabs.Screen name="messages" />
            <Tabs.Screen name="profile" />
        </Tabs>
        <MainView />
    </View>);
}


// 全局样式定义
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: Util.size.width,
        height: Util.size.height,
    }
});