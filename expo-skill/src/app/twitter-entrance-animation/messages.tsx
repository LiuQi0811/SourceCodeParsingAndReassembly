import { StyleSheet, Text, View } from 'react-native';

export default function MessagesPage() {
    return (<View style={styles.container}>
        <Text>私信页面</Text>
    </View>);
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    }
});