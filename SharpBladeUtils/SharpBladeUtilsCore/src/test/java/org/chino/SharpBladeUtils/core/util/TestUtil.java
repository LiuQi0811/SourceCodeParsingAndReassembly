package org.chino.SharpBladeUtils.core.util;


import org.chino.SharpBladeUtils.core.map.MapUtil;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

/**
 * @ClassName TestUtil
 * @Description TestUtil
 * @Author LiuQi
 */
public class TestUtil {

    @Test
    public void testUtil(){
        System.out.println(MapUtil.newHashMap(Math.min(20,40),true));
    }
}
