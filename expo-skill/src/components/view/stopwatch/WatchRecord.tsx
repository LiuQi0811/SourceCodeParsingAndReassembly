import Util from '@/common/Util';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { RecordProps } from './Constant';


/** 
 * WatchRecord 
 * @author LiuQi
 */
export default function WatchRecord({ record }: { record: RecordProps[] }) {
    return (
        <FlatList style={styles.recordList} data={record} keyExtractor={(item, index) => String(index)} renderItem={({ item }) => (<View style={styles.recordItem}>
            <Text style={styles.recordItemTitle}>{item.title}</Text>
            <View style={{ alignItems: "center" }}>
                <Text style={styles.recordItemTime}>{item.time}</Text>
            </View>
        </View>)} />

    );
}


/**
 * styles 样式表
 * @author LiuQi
 * @returns StyleSheet 样式表
 */
const styles = StyleSheet.create({
    recordList: {
        width: Util.size.width,
        height: Util.size.height - 300,
        paddingLeft: 15
    },
    recordItem: {
        height: 40,
        borderBottomWidth: Util.pixel,
        borderBottomColor: "#bbb",
        paddingTop: 5,
        paddingLeft: 10,
        paddingRight: 10,
        paddingBottom: 5,
        flexDirection: "row",
        alignItems: "center"
    },
    recordItemTitle: {
        backgroundColor: "transparent",
        flex: 1,
        textAlign: "left",
        paddingLeft: 20,
        color: "#777"
    },
    recordItemTime: {
        backgroundColor: "transparent",
        flex: 1,
        textAlign: "right",
        paddingRight: 20,
        color: "#222"
    }
});