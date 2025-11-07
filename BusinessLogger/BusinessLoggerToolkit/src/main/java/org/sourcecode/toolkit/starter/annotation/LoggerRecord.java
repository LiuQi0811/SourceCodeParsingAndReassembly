package org.sourcecode.toolkit.starter.annotation;


import java.lang.annotation.*;

/**
 * @ClassName LoggerRecord
 * @Description LoggerRecord
 * @Author LiuQi
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface LoggerRecord {

}
