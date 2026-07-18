import Util from '@/common/Util';
import { FontAwesome6 } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/**
 * Entrance 启动动画全屏组件
 * @param {hideThis} 
 * @returns 
 * @author LiuQi
 */
const Entrance: React.FC<{ hideThis: () => void }> = ({ hideThis }) => {
    const transformAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;
    const AnimatedIcon = Animated.createAnimatedComponent(FontAwesome6);
    useEffect(() => {
        // 图标弹性放大动画
        Animated.timing(transformAnim, {
            toValue: 20,
            duration: 1200,
            delay: 2000,
            easing: Easing.elastic(2),
            useNativeDriver: true
        }).start();
        Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 800,
            delay: 2200,
            easing: Easing.elastic(1),
            useNativeDriver: true
        }).start();
        const timer = setTimeout(() => hideThis(), 3300);
        return () => clearTimeout(timer);
    }, []);
    return <Animated.View style={[styles.entrance, { opacity: opacityAnim }]}>
        <AnimatedIcon name={"x-twitter"} size={60} style={[styles.twitterIcon, { transform: [{ scale: transformAnim }] }]} color="#fff" />
    </Animated.View>
};
/**
 * TwitterEntranceAnimation main view
 * @author LiuQi
 */
export default function App() {
    const [showEntrance, setShowEntrance] = useState(true);
    const hideEntrance = () => setShowEntrance(false);
    return <>{showEntrance && <Entrance hideThis={hideEntrance} />}</>;
}


// 全局样式定义
const styles = StyleSheet.create({
    entrance: {
        position: "absolute",
        top: 0,
        left: 0,
        height: Util.size.height,
        width: Util.size.width,
        backgroundColor: "#1b95e0",
        alignItems: "center",
        justifyContent: "center"
    },
    twitterIcon: {
        top: -20
    }
});