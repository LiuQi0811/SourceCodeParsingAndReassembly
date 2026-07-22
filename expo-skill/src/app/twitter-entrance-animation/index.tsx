import Util from '@/common/Util';
import UniversalIcon from '@/components/UniversalIcon';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';


export default function HomePage() {
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const onRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };
    return (<View style={styles.pageContainer}>
        {/* 顶部导航栏 */}
        <View style={styles.nav}>
            <View style={styles.navLeft}>
                <UniversalIcon family="Ionicons" iconName="person-add" size={23} style={{ paddingLeft: 10 }} />
            </View>
            <View style={styles.navMid}>
                <UniversalIcon family="FontAwesome6" iconName="x-twitter" size={27} color="#1b95e0" />
            </View>
            <View style={styles.navRight}>
                <UniversalIcon family="Ionicons" iconName="search" size={23} color="#1b95e0" style={{ width: 30 }} />
                <UniversalIcon family="Ionicons" iconName="create" size={23} color="#1b95e0" style={{ width: 30, paddingRight: 10 }} />
            </View>
        </View>
        {/* 可下拉刷新信息流 */}
        <ScrollView style={styles.twitterPostContainer} refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#ddd" />
        }>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", height: Util.size.height - 110 }}>
                <Text>Twitter 主页信息流</Text>
            </View>
        </ScrollView>
    </View>);
}


const styles = StyleSheet.create({
    pageContainer: {
        flex: 1
    },
    nav: {
        flexDirection: "row",
        paddingTop: 30,
        borderBottomWidth: Util.pixel,
        borderBottomColor: "#ddd",
        paddingBottom: 5,
        backgroundColor: "#fff",
    },
    navLeft: {
        flex: 1,
        alignItems: "flex-start",
        justifyContent: "center"
    },
    navMid: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    navRight: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "center",
        flexDirection: "row"
    },
    twitterPostContainer: {

    }
});