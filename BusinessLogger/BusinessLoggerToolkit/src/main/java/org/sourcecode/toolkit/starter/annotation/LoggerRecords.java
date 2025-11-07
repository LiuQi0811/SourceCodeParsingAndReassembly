package org.sourcecode.toolkit.starter.annotation;


import java.lang.annotation.*;

/**
 * @ClassName LoggerRecords
 * @Description LoggerRecords
 * @Author LiuQi
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface LoggerRecords {
    LoggerRecord[] value();
}
