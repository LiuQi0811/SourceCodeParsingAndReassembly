import { StyleSheet, Text, View } from 'react-native';

export default function ProfilePage() {
    return (<View style={styles.container}>
        <Text>我 - 个人主页</Text>
    </View>);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    }
});