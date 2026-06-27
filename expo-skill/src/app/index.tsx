// import * as Device from 'expo-device';
// import { Platform, StyleSheet } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';

// import { AnimatedIcon } from '@/components/animated-icon';
// import { HintRow } from '@/components/hint-row';
// import { ThemedText } from '@/components/themed-text';
// import { ThemedView } from '@/components/themed-view';
// import { WebBadge } from '@/components/web-badge';
// import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// function getDevMenuHint() {
//   if (Platform.OS === 'web') {
//     return <ThemedText type="small">use browser devtools</ThemedText>;
//   }
//   if (Device.isDevice) {
//     return (
//       <ThemedText type="small">
//         shake device or press <ThemedText type="code">m</ThemedText> in terminal
//       </ThemedText>
//     );
//   }
//   const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
//   return (
//     <ThemedText type="small">
//       press <ThemedText type="code">{shortcut}</ThemedText>
//     </ThemedText>
//   );
// }

// export default function HomeScreen() {
//   return (
//     <ThemedView style={styles.container}>
//       <SafeAreaView style={styles.safeArea}>
//         <ThemedView style={styles.heroSection}>
//           <AnimatedIcon />
//           <ThemedText type="title" style={styles.title}>
//             Welcome to&nbsp;Expo
//           </ThemedText>
//         </ThemedView>

//         <ThemedText type="code" style={styles.code}>
//           get started
//         </ThemedText>

//         <ThemedView type="backgroundElement" style={styles.stepContainer}>
//           <HintRow
//             title="Try editing"
//             hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
//           />
//           <HintRow title="Dev tools" hint={getDevMenuHint()} />
//           <HintRow
//             title="Fresh start"
//             hint={<ThemedText type="code">npm run reset-project</ThemedText>}
//           />
//         </ThemedView>

//         {Platform.OS === 'web' && <WebBadge />}
//       </SafeAreaView>
//     </ThemedView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     flexDirection: 'row',
//   },
//   safeArea: {
//     flex: 1,
//     paddingHorizontal: Spacing.four,
//     alignItems: 'center',
//     gap: Spacing.three,
//     paddingBottom: BottomTabInset + Spacing.three,
//     maxWidth: MaxContentWidth,
//   },
//   heroSection: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     flex: 1,
//     paddingHorizontal: Spacing.four,
//     gap: Spacing.four,
//   },
//   title: {
//     textAlign: 'center',
//   },
//   code: {
//     textTransform: 'uppercase',
//   },
//   stepContainer: {
//     gap: Spacing.three,
//     alignSelf: 'stretch',
//     paddingHorizontal: Spacing.three,
//     paddingVertical: Spacing.four,
//     borderRadius: Spacing.four,
//   },
// });

import Util from '@/common/Util';
import UniversalIcon from '@/components/UniversalIcon';
import type { AppMenuItem } from '@/config/appMenuConfig';
import { APP_MENU_CONFIG } from '@/config/appMenuConfig';
import type { RelativePathString } from 'expo-router';
import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import Swiper from 'react-native-swiper';

/**
 * AppMainView 应用主视图
 * @author LiuQi
 * @returns  JSX.Element 应用主视图
 */
export default function AppMainView() {

  /**
   * jumpToLink 页面跳转
   * @param routerKey {@link RoutePath} 页面路由路径
   * @param title  {@link string} 页面标题
   * @author LiuQi
   */
  const jumpToLink = (routerKey: RelativePathString, title: string) => {
    router.navigate({ pathname: routerKey as RelativePathString, params: { pageTitle: title } });
  }

  /**
   * renderView 渲染视图
   * @author LiuQi
   * @returns JSX.Element[] 渲染的视图数组
   */
  const renderView = APP_MENU_CONFIG.map((element: AppMenuItem, index: number) => {
    // Return the JSX for each element in the appCollection
    return (<TouchableHighlight
      key={element.routerKey}
      style={[styles.touchBox, index % 3 === 2 ? styles.touchBox__ : styles.touchBox_]}
      underlayColor="#eee"
      onPress={() => jumpToLink(element.routerKey as RelativePathString, element.title)}
    >
      <View style={styles.boxContainer}>
        <Text style={styles.boxText}>{element.title}</Text>
        <UniversalIcon
          family={element.family}
          iconName={element.icon}
          size={element.size}
          color={element.color}
          style={styles.boxIcon}
        />
      </View>
    </TouchableHighlight>);
  });
  return (<ScrollView style={styles.mainView}>
    <Swiper
      height={150}
      showsButtons={false}
      autoplay={true}
      activeDot={<View style={{ backgroundColor: "rgba(255,255,255,0.8)", width: 8, height: 8, borderRadius: 4, marginLeft: 3, marginRight: 3, marginTop: 3, marginBottom: 3 }} />}
    >
      <TouchableHighlight>
        <View style={styles.slide}>
          <Image style={styles.image} resizeMode="cover" source={{ uri: "https://cdn.pixabay.com/objects3d/2026/06/05/04-04-44-807/render_720_720_0_340_0.png" }} />
          <Text style={styles.slideText}>ONE</Text>
        </View>
      </TouchableHighlight>
      <TouchableHighlight>
        <View style={styles.slide}>
          <Image style={styles.image} resizeMode="cover" source={{ uri: "https://images.pexels.com/photos/37636721/pexels-photo-37636721.jpeg" }} />
          <Text style={styles.slideText}>TWO</Text>
        </View>
      </TouchableHighlight>
    </Swiper>
    <View style={styles.touchBoxContainer}>
      {renderView}
    </View>
  </ScrollView>);
}


/**
 * styles StyleSheet.create 样式创建
 * @author LiuQi
 */
const styles = StyleSheet.create({
  mainView: {
    marginTop: 55
  },
  boxContainer: {
    width: Util.size.width / 3,
    height: Util.size.width / 3,
    alignItems: "center",
    justifyContent: "center"
  },
  touchBoxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: Util.size.width,
    borderTopWidth: Util.pixel,
    borderTopColor: "#ccc",
    borderLeftWidth: Util.pixel,
    borderLeftColor: "#ccc",
    borderRightWidth: Util.pixel,
    borderRightColor: "#ccc"
  },
  touchBox: {
    width: Util.size.width / 3 - 0.33334,
    height: Util.size.width / 3,
    backgroundColor: "#fff"
  },
  touchBox_: {
    borderBottomWidth: Util.pixel,
    borderBottomColor: "#ccc",
    borderRightWidth: Util.pixel,
    borderRightColor: "#ccc"
  },
  touchBox__: {
    borderBottomWidth: Util.pixel,
    borderBottomColor: "#ccc",
    borderLeftWidth: Util.pixel,
    borderLeftColor: "#ccc"
  },
  boxText: {
    position: "absolute",
    bottom: 15,
    left: 0,
    width: Util.size.width / 3,
    textAlign: "center",
    backgroundColor: "transparent"
  },
  boxIcon: {
    position: "relative",
    top: -10
  },
  slide: {
    flex: 1,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  slideText: {
    position: "absolute",
    bottom: 0,
    paddingTop: 5,
    paddingBottom: 5,
    backgroundColor: "rgba(255,255,255,0.5)",
    width: Util.size.width,
    textAlign: "center",
    fontSize: 12
  },
  image: {
    width: Util.size.width,
    height: 80,
    flex: 1,
    alignSelf: "stretch"
  }
});

