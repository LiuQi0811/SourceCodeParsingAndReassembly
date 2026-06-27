import Util from '@/common/Util';
import { useState } from 'react';
import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';

/**
 * WatchControlProps  
 * @author LiuQi
 */
type WatchControlProps = {
    addRecord: () => void;
    clearRecord: () => void;
    startWatch: () => void;
    stopWatch: () => void;
};

/**
 * WatchControl 
 * @param props 
 * @author LiuQi
 * @returns 
 */
export default function WatchControl(props: WatchControlProps) {
    const { addRecord, clearRecord, startWatch, stopWatch } = props;
    const [watchOn, setWatchOn] = useState<boolean>(false);
    const [startButtonText, setStartButtonText] = useState<string>("启动");
    const [startButtonColor, setStartButtonColor] = useState<string>("#60B644");
    const [stopButtonText, setStopButtonText] = useState<string>("计次");
    const [underlayColor, setUnderlayColor] = useState<string>("#fff");

    /**
     * handleAddRecord
     * @author LiuQi
     */
    const handleAddRecord = () => {
        if (watchOn) {
            addRecord();
        } else {
            clearRecord();
            setStopButtonText("计次");
        }
    };

    /**
     * handleStartWatch
     * @author LiuQi
     */
    const handleStartWatch = () => {
        if (!watchOn) {
            startWatch();
            setStartButtonText("停止");
            setStartButtonColor("#ff0044");
            setStopButtonText("计次");
            setUnderlayColor("#eee");
            setWatchOn(true);
        } else {
            stopWatch();
            setStartButtonText("启动");
            setStartButtonColor("#60B644");
            setStopButtonText("复位");
            setUnderlayColor("#eee");
            setWatchOn(false);
        }
    };

    return (
        <View style={styles.watchControlContainer}>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
                <TouchableHighlight
                    style={styles.buttonStop}
                    underlayColor={underlayColor}
                    onPress={handleAddRecord}>
                    <Text style={styles.buttonStoptText}>{stopButtonText}</Text>
                </TouchableHighlight>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
                <TouchableHighlight
                    style={styles.buttonStart}
                    underlayColor="#eee"
                    onPress={handleStartWatch}>
                    <Text style={[styles.buttonStartText, { color: startButtonColor }]}>{startButtonText}</Text>
                </TouchableHighlight>
            </View>
        </View>
    );
}

/**
 * styles 样式表
 * @author LiuQi
 * @returns StyleSheet 样式表
 */
const styles = StyleSheet.create({
    watchControlContainer: {
        width: Util.size.width,
        height: 100,
        flexDirection: "row",
        backgroundColor: "#f3f3f3",
        paddingTop: 30,
        paddingLeft: 60,
        paddingRight: 60,
        paddingBottom: 0
    },
    buttonStart: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center"
    },
    buttonStartText: {
        fontSize: 14,
        backgroundColor: "transparent"
    },
    buttonStop: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center"
    },
    buttonStoptText: {
        fontSize: 14,
        backgroundColor: "transparent",
        color: "#555"
    }
});