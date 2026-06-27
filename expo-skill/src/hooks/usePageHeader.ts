
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

/**
 * usePageHeader  hook to set the page header title based on the 'pageTitle' query parameter in the URL. 
 * @author LiuQi
 * @returns  The hook returns the current search parameters, allowing components to access them if needed.
 */
export function usePageHeader() {
    const navigation = useNavigation();
    const params = useLocalSearchParams<{ pageTitle?: string }>();
    useEffect(() => {
        if (params.pageTitle) {
            navigation.setOptions({
                title: params.pageTitle,
            });
        }
    }, [navigation, params.pageTitle]);
    return params;
}