
import { usePageHeader } from '@/hooks/usePageHeader';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RecordProps } from './Constant';
import WatchControl from './WatchControl';
import WatchFace from './WatchFace';
import WatchRecord from './WatchRecord';

/**
 * StopWatchMainView 计时器主视图
 * @author LiuQi
 * @returns  JSX.Element 计时器主视图
 */
export default function StopWatchMainView() {
    usePageHeader();
    const [sectionTime, setSectionTime] = useState<string>("00:00.0");
    const [totalTime, setTotalTime] = useState<string>("00:00.0");
    const [recordTime, setRecordTime] = useState<number>(0);
    const [timeAccumulation, setTimeAccumulation] = useState<number>(0);
    const [record, setRecord] = useState<RecordProps[]>([]);
    const [resetWatch, setResetWatch] = useState(true);
    const intervalRef = useRef<any>(null);
    const realStartTimeRef = useRef<number>(0);
    const [recordCounter, setRecordCounter] = useState<number>(0);

    /** 
     * useEffect 
     * @author LiuQi
     */
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
    }, []);

    /**
     * handleAddRecord 
     * @author LiuQi
     */
    const handleAddRecord = () => {
        const newCount = recordCounter + 1;
        setRecordCounter(newCount);
        const newItem = { title: `计次${newCount}`, time: sectionTime };
        let newRecordList = [newItem, ...record];
        if (newRecordList.length > 8) {
            newRecordList = newRecordList.slice(0, 8);
        }
        setRecord(newRecordList);
        setRecordTime(timeAccumulation);
    };

    /**
     * handleClearRecord
     * @author LiuQi
     */
    const handleClearRecord = () => {
        setResetWatch(true);
        setRecordTime(0);
        setSectionTime("00:00.0");
        setTotalTime("00:00.0");
        setRecordCounter(0);
        setRecord([]);
    };

    /**
     * handleStartWatch
     * @author LiuQi
     */
    const handleStartWatch = () => {
        const nowTime = new Date().getTime();
        if (resetWatch) {
            setResetWatch(false);
            setTimeAccumulation(0);
            setRecordTime(0);
            realStartTimeRef.current = nowTime;
        } else {
            realStartTimeRef.current = nowTime - timeAccumulation;
        }
        if (intervalRef.current) { clearInterval(intervalRef.current); }
        intervalRef.current = setInterval(() => {
            const currentTime = new Date().getTime();
            const countingTime = currentTime - realStartTimeRef.current;

            const minute = Math.floor(countingTime / (60 * 1000));
            const second = Math.floor((countingTime % (60 * 1000)) / 1000);
            const milSecond = Math.floor((countingTime % 1000) / 10);

            const seccountingTime = countingTime - recordTime;
            const secminute = Math.floor(seccountingTime / (60 * 1000));
            const secsecond = Math.floor((seccountingTime % (60 * 1000)) / 1000);
            const secmilSecond = Math.floor((seccountingTime % 1000) / 10);

            setTotalTime(
                `${minute < 10 ? "0" + minute : minute}:${second < 10 ? "0" + second : second
                }.${milSecond < 10 ? "0" + milSecond : milSecond}`
            );
            setSectionTime(
                `${secminute < 10 ? "0" + secminute : secminute}:${secsecond < 10 ? "0" + secsecond : secsecond
                }.${secmilSecond < 10 ? "0" + secmilSecond : secmilSecond}`
            );
            setTimeAccumulation(countingTime);
        }, 100);
    };

    /**
     * handleStopWatch
     * @author LiuQi
     */
    const handleStopWatch = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };
    return (<View style={styles.watchContainer}>
        <WatchFace sectionTime={sectionTime} totalTime={totalTime} />
        <WatchControl addRecord={handleAddRecord} clearRecord={handleClearRecord} startWatch={handleStartWatch} stopWatch={handleStopWatch} />
        <WatchRecord record={record} />
    </View>);
}

/**
 * styles 样式表
 * @author LiuQi
 * @returns StyleSheet 样式表
 */
const styles = StyleSheet.create({
    watchContainer: {
        alignItems: "center",
        backgroundColor: "#f3f3f3",
        marginTop: 60
    }
});