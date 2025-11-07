package org.sourcecode.toolkit.starter.support.aop;


import org.springframework.aop.Pointcut;
import org.springframework.aop.support.AbstractBeanFactoryPointcutAdvisor;

/**
 * @ClassName BeanFactoryLoggerRecordAdvisor
 * @Description BeanFactoryLoggerRecordAdvisor
 * @Author LiuQi
 */
public class BeanFactoryLoggerRecordAdvisor extends AbstractBeanFactoryPointcutAdvisor {
    private final LoggerRecordPointcut loggerRecordPointcut = new LoggerRecordPointcut();

    @Override
    public Pointcut getPointcut() {
        return loggerRecordPointcut;
    }

    public void setLoggerRecordOperationSource(LoggerRecordOperationSource loggerRecordOperationSource) {
       loggerRecordPointcut.setLoggerRecordOperationSource(loggerRecordOperationSource);
    }

}
