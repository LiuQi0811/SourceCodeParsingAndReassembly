package org.sourcecode.toolkit.starter.annotation;


import java.lang.annotation.*;

/**
 * @ClassName DiffLoggerField
 * @Description DiffLoggerField
 * @Author LiuQi
 */
@Retention(RetentionPolicy.RUNTIME)
public @interface DiffLoggerField {
    String name();

    String function() default "";
}
