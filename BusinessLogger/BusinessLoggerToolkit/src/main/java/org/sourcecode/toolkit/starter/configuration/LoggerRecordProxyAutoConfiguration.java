package org.sourcecode.toolkit.starter.configuration;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.service.*;
import org.sourcecode.toolkit.service.impl.*;
import org.sourcecode.toolkit.starter.annotation.EnableLoggerRecord;
import org.sourcecode.toolkit.starter.support.aop.BeanFactoryLoggerRecordAdvisor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordInterceptor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordOperationSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.AnnotationAttributes;
import org.springframework.core.type.AnnotationMetadata;

import java.util.List;

/**
 * @ClassName LoggerRecordProxyAutoConfiguration
 * @Description LoggerRecordProxyAutoConfiguration
 * @Author LiuQi
 */
@Configuration
public class LoggerRecordProxyAutoConfiguration implements ImportAware {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoggerRecordProxyAutoConfiguration.class);
    private AnnotationAttributes annotationAttributes;

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public LoggerRecordOperationSource loggerRecordOperationSource() {
        return new LoggerRecordOperationSource();
    }

    @Bean
    @DependsOn(value = "loggerRecordInterceptor")
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public BeanFactoryLoggerRecordAdvisor loggerRecordAdvisor(LoggerRecordInterceptor loggerRecordInterceptor) {
        BeanFactoryLoggerRecordAdvisor beanFactoryLoggerRecordAdvisor = new BeanFactoryLoggerRecordAdvisor();
        beanFactoryLoggerRecordAdvisor.setLoggerRecordOperationSource(loggerRecordOperationSource());
        beanFactoryLoggerRecordAdvisor.setAdvice(loggerRecordInterceptor);
        return beanFactoryLoggerRecordAdvisor;
    }

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    public LoggerRecordInterceptor loggerRecordInterceptor() {
        LOGGER.info(" // TODO ........");
        LoggerRecordInterceptor loggerRecordInterceptor = new LoggerRecordInterceptor();
        loggerRecordInterceptor.setTenant("TENANT_");
        loggerRecordInterceptor.setLoggerRecordOperationSource(loggerRecordOperationSource());
        loggerRecordInterceptor.setLoggerRecordPerformanceMonitor(loggerRecordPerformanceMonitor());
        return loggerRecordInterceptor;
    }

    @Bean
    @ConditionalOnMissingBean(value = ILoggerRecordPerformanceMonitor.class)
    public ILoggerRecordPerformanceMonitor loggerRecordPerformanceMonitor() {
        return new DefaultLoggerRecordPerformanceMonitor();
    }

    @Bean
    @ConditionalOnMissingBean(value = IFunctionService.class)
    public IFunctionService functionService(ParseFunctionFactory parseFunctionFactory) {
        return new DefaultFunctionServiceImpl(parseFunctionFactory);
    }

    @Bean
    public ParseFunctionFactory parseFunctionFactory(@Autowired List<IParseFunction> parseFunctions) {
        return new ParseFunctionFactory(parseFunctions);
    }

    @Bean
    @ConditionalOnMissingBean(IParseFunction.class)
    public DefaultParseFunction parseFunction() {
        return new DefaultParseFunction();
    }

    @Bean
    public DiffParseFunction diffParseFunction() {
        return new DiffParseFunction();
    }

    @Bean
    @ConditionalOnMissingBean(value = ILoggerRecordService.class)
    @Role(value = BeanDefinition.ROLE_APPLICATION)
    public ILoggerRecordService recordService() {
        return new DefaultLoggerRecordServiceImpl();
    }

    @Bean
    @ConditionalOnMissingBean(value = IOperatorGetService.class)
    @Role(BeanDefinition.ROLE_APPLICATION)
    public IOperatorGetService operatorGetService() {
        return new DefaultOperatorGetServiceImpl();
    }

    @Override
    public void setImportMetadata(AnnotationMetadata importMetadata) {
        this.annotationAttributes = AnnotationAttributes.fromMap(importMetadata.getAnnotationAttributes(EnableLoggerRecord.class.getName(), false));
        if (this.annotationAttributes == null) {
            LOGGER.error("EnableLoggerRecord is not present on importing class");
        }
    }
}
