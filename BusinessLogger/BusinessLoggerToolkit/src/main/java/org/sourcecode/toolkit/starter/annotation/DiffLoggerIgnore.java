package org.sourcecode.toolkit.starter.annotation;


import java.lang.annotation.*;

/**
 * @ClassName DiffLoggerIgnore
 * @Description DiffLoggerIgnore
 * @Author LiuQi
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface DiffLoggerIgnore {
}
