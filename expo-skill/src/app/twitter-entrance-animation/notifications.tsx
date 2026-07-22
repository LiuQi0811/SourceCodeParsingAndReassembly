import { StyleSheet, Text, View } from 'react-native';

export default function NotificationsPage() {
    return (<View style={styles.container}>
        <Text>通知页面</Text>
    </View>);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    }
});