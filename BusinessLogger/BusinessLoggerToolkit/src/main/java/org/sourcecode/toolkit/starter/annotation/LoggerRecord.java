package org.sourcecode.toolkit.starter.annotation;


import java.lang.annotation.*;

/**
 * @ClassName LoggerRecord
 * @Description LoggerRecord
 * @Author LiuQi
 */
@Repeatable(LoggerRecords.class)
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface LoggerRecord {
    String success();

    String fail() default "";

    String operator() default "";

    String type();

    String subType() default "";

    String bizNo();

    String extra() default "";

    String condition() default "";

    String successCondition() default "";
}
