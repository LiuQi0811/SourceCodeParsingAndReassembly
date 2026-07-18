
import { StyleSheet, View } from 'react-native';
import Weather from './Weather';

/**
 * Weather main view
 * @returns 
 * @author LiuQi
 */
export default function App() {
    return (<View style={styles.weatherContainer}>
        <Weather />
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