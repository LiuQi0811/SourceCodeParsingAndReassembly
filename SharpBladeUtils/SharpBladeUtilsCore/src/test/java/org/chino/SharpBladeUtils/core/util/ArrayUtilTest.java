package org.chino.SharpBladeUtils.core.util;


import org.chino.SharpBladeUtils.core.arrray.ArrayUtil;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.Map;
import java.util.Objects;

/**
 * @ClassName ArrayUtilTest
 * @Description ArrayUtilTest {@link ArrayUtil}数组工具单元测试
 * @Author LiuQi
 */
public class ArrayUtilTest {
    @Test
    public void isEmptyTest() {
        int[] a = {};
        Assertions.assertTrue(ArrayUtil.isEmpty(a));
        Assertions.assertTrue(ArrayUtil.isEmpty(((Object) a)));
        int[] b = null;
        Assertions.assertTrue(ArrayUtil.isEmpty(b));
        Object c = null;
        Assertions.assertTrue(ArrayUtil.isEmpty(c));
        Object d = new Object[]{"1", "A", 3, 4D, 5F};
        boolean isEmpty = ArrayUtil.isEmpty(d);
        Assertions.assertFalse(isEmpty);
        d = new Object[0];
        isEmpty = ArrayUtil.isEmpty(d);
        Assertions.assertTrue(isEmpty);
        d = null;
        isEmpty = ArrayUtil.isEmpty(d);
        Assertions.assertTrue(isEmpty);
        Object[] e = new Object[]{"1", "A", 3, 4D, 5F};
        Assertions.assertFalse(ArrayUtil.isEmpty(e));
    }

    @Test
    public void isNotEmptyTest() {
        int[] a = {1, 2};
        Assertions.assertTrue(ArrayUtil.isNotEmpty(a));
        String[] b = {"a", "b", "c"};
        Assertions.assertTrue(ArrayUtil.isNotEmpty(b));
        Object c = new Object[]{"1", "2", 3, 4D};
        Assertions.assertTrue(ArrayUtil.isNotEmpty(c));
    }

    @Test
    public void newArrayTest() {
        String[] newArray = ArrayUtil.newArray(String.class, 3);
        Assertions.assertEquals(3, newArray.length);
    }

    @Test
    public void cloneTest() {
        Integer[] a = {1, 2, 3};
        Integer[] cloneA = ArrayUtil.clone(a);
        Assertions.assertArrayEquals(a, cloneA);
        int[] b = {1, 2, 3};
        int[] cloneB = ArrayUtil.clone(b);
        Assertions.assertArrayEquals(b, cloneB);
    }

    @Test
    public void filterEditTest() {
        Integer[] a = {1, 2, 3, 4, 5, 6};
        Integer[] filterEdit = ArrayUtil.edit(a, R -> (R % 2 == 0) ? R : null);
        Assertions.assertArrayEquals(filterEdit, new Integer[]{2, 4, 6});
    }

    @Test
    public void filterTestForFilter() {
        Integer[] a = {1, 2, 3, 4, 5, 6};
        Integer[] filter = ArrayUtil.filter(a, R -> R % 2 == 0);
        Assertions.assertArrayEquals(filter, new Integer[]{2, 4, 6});
    }

    @Test
    public void editTest() {
        Integer[] a = {1, 2, 3, 4, 5, 6};
        Integer[] editArrays = ArrayUtil.edit(a, R -> R % 2 == 0 ? R * 10 : R);
        Assertions.assertArrayEquals(editArrays, new Integer[]{1, 20, 3, 40, 5, 60});
    }

    @Test
    public void indexOfTest() {
        Integer[] a = {1, 2, 3, 4, 5, 6};
        int i1 = ArrayUtil.indexOf(a, 3);
        Assertions.assertEquals(2, i1);
        long[] b = {1, 2, 3, 4, 5, 6};
        int i2 = ArrayUtil.indexOf(b, 3);
        Assertions.assertEquals(2, i2);

    }

    @Test
    public void lastIndexOfTest() {
        Integer[] a = {1, 2, 3, 4, 3, 6};
        int i1 = ArrayUtil.lastIndexOf(a, 3);
        Assertions.assertEquals(4, i1);
        long[] b = {1, 2, 3, 4, 3, 6};
        int i2 = ArrayUtil.lastIndexOf(b, 3);
        Assertions.assertEquals(4, i2);
    }

    @Test
    public void containsTest() {
        Integer[] a = {1, 2, 3, 4, 3, 6};
        boolean c1 = ArrayUtil.contains(a, 3);
        Assertions.assertTrue(c1);
        long[] b = {1, 2, 3, 4, 3, 6};
        boolean c2 = ArrayUtil.contains(b, 3);
        Assertions.assertTrue(c2);
    }

    @Test
    public void containsAnyTest() {
        Integer[] a = {1, 2, 3, 4, 3, 6};
        boolean ca1 = ArrayUtil.containsAny(a, 4, 10, 40);
        Assertions.assertTrue(ca1);
        ca1 = ArrayUtil.containsAny(a, 55, 66, 77);
        Assertions.assertFalse(ca1);
    }

    @Test
    public void containsAllTest() {
        Integer[] a = {1, 2, 3, 4, 3, 6};
        boolean cta1 = ArrayUtil.containsAll(a, 2, 3, 4);
        Assertions.assertTrue(cta1);
        cta1 = ArrayUtil.containsAll(a, 2, 3, 5, 7);
        Assertions.assertFalse(cta1);
    }

    @Test
    public void mapTest() {
        String[] keys = {"a", "b", "c"};
        Integer[] values = {1, 2, 3};
        Map<String, Integer> z1 = ArrayUtil.zip(keys, values, true);
        Assertions.assertEquals(Objects.requireNonNull(z1).toString(), "{a=1, b=2, c=3}");
    }

    @Test
    public void castTest() {
        Object[] values = {"1", "2", "3"};
        String[] cast = (String[]) ArrayUtil.cast(String.class, values);
        Assertions.assertEquals(values[0], cast[0]);
        Assertions.assertEquals(values[1], cast[1]);
        Assertions.assertEquals(values[2], cast[2]);
    }

    @Test
    public void rangeTest() {
        int[] range = ArrayUtil.range(0, 10);
        Assertions.assertEquals(5, range[5]);
    }

    @Test
    public void rangeMinTest() {
        Assertions.assertThrows(NegativeArraySizeException.class, () -> {
            ArrayUtil.range(0, Integer.MIN_VALUE);
        });
    }

    @Test
    public void maxTest() {
        int maxNumber = ArrayUtil.max(1, 2, 13, 3, 5, 6, 32, 8);
        Assertions.assertEquals(32, maxNumber);
        long maxLong = ArrayUtil.max(1L, 2L, 13L, 4L, 5L);
        Assertions.assertEquals(13, maxLong);
        double maxDouble = ArrayUtil.max(1D, 2.4D, 13.0D, 4.55D, 5D);
        Assertions.assertEquals(13.0, maxDouble, 0);
        BigDecimal one = new BigDecimal("1.00");
        BigDecimal two = new BigDecimal("2.0");
        BigDecimal three = new BigDecimal("3");
        BigDecimal[] bigDecimals = {two, one, three};
        BigDecimal maxAccuracy = ArrayUtil.max(bigDecimals, Comparator.comparingInt(BigDecimal::scale));
        Assertions.assertEquals(maxAccuracy, one);
    }
}
