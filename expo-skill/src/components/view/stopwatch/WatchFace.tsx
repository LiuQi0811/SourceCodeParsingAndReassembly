import Util from '@/common/Util';
import { StyleSheet, Text, View } from 'react-native';

/** 
 * WatchFace
 * @author LiuQi
 */
export default function WatchFace({ sectionTime, totalTime }: { sectionTime?: string; totalTime?: string }) {
    return (
        <View style={styles.watchFaceContainer}>
            <Text style={styles.sectionTime}>{sectionTime}</Text>
            <Text style={styles.totalTime}>{totalTime}</Text>
        </View>
    );
}


/**
 * styles 样式表
 * @author LiuQi
 * @returns StyleSheet 样式表
 */
const styles = StyleSheet.create({
    watchFaceContainer: {
        width: Util.size.width,
        paddingTop: 50,
        paddingLeft: 30,
        paddingRight: 30,
        paddingBottom: 40,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        height: 170
    },
    sectionTime: {
        fontSize: 20,
        fontWeight: 100,
        paddingRight: 30,
        color: "#555",
        position: "absolute",
        left: Util.size.width - 140,
        top: 30
    },
    totalTime: {
        fontSize: Util.size.width === 375 ? 70 : 60,
        fontWeight: 100,
        color: "#222",
        paddingLeft: 20
    }
});