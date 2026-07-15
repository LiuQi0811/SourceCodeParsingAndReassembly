import type { IconFamily } from '@/config/appMenuConfig';
import { AntDesign, Entypo, EvilIcons, Feather, FontAwesome, FontAwesome5, FontAwesome6, Fontisto, Foundation, Ionicons, MaterialCommunityIcons, MaterialIcons, Octicons, SimpleLineIcons, Zocial } from '@expo/vector-icons';
import React from 'react';

const IconFamilyMap: Record<IconFamily, typeof FontAwesome6 | typeof Ionicons | typeof AntDesign | typeof Feather | typeof Entypo | typeof FontAwesome | typeof FontAwesome5 | typeof Fontisto | typeof Foundation | typeof MaterialCommunityIcons | typeof MaterialIcons | typeof Octicons | typeof SimpleLineIcons | typeof Zocial | typeof EvilIcons> = {
    "FontAwesome6": FontAwesome6,
    "Ionicons": Ionicons,
    "AntDesign": AntDesign,
    "Feather": Feather,
    "Entypo": Entypo,
    "FontAwesome": FontAwesome,
    "FontAwesome5": FontAwesome5,
    "Fontisto": Fontisto,
    "Foundation": Foundation,
    "MaterialCommunityIcons": MaterialCommunityIcons,
    "MaterialIcons": MaterialIcons,
    "Octicons": Octicons,
    "SimpleLineIcons": SimpleLineIcons,
    "Zocial": Zocial,
    "EvilIcons": EvilIcons
};


interface UniversalIconProps {
    family: IconFamily;
    iconName: string;
    size?: number;
    color?: string;
    style?: any;
}


const UniversalIcon: React.FC<UniversalIconProps> = ({ family, iconName, size, color, style }) => {
    const IconComp = IconFamilyMap[family];
    return (
        <IconComp
            name={iconName}
            size={size}
            color={color}
            style={style}
        />
    );
};

export default UniversalIcon;