import { Dimensions, PixelRatio } from 'react-native';


/**
 * Util module provides utility functions and constants for the application.
 * @author LiuQi
 */
const Util = {
    size: { // Get the width and height of the device's window
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height
    },
    // Get the pixel density of the device's screen
    pixel: 1 / PixelRatio.get(),
};

// Export the Util module as the default export
export default Util;
