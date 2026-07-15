
import { StyleSheet, View } from 'react-native';
import Weather from './Weather';
export default function WeatherMainView() {
    return (<View style={styles.weatherContainer}>
        <Weather back="" />
    </View>);
}


/**
 * styles 样式表
 * @author LiuQi
 * @returns StyleSheet 样式表
 */
const styles = StyleSheet.create({
    weatherContainer: {
        flex: 1
    }
});