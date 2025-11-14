package org.sourcecode.toolkit.starter.annotation;


import org.sourcecode.toolkit.starter.support.LoggerRecordConfigureSelector;
import org.springframework.context.annotation.AdviceMode;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;

import java.lang.annotation.*;

/**
 * @ClassName EnableLoggerRecord
 * @Description EnableLoggerRecord
 * @Author LiuQi
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Import(value = LoggerRecordConfigureSelector.class)
public @interface EnableLoggerRecord {
    
    String tenant();

    AdviceMode mode() default AdviceMode.PROXY;

    boolean enrolTransaction() default false;

    int order() default Ordered.LOWEST_PRECEDENCE;
}
