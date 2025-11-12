package org.sourcecode.toolkit.starter.configuration;


import org.apache.commons.logging.Log;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.service.*;
import org.sourcecode.toolkit.service.impl.*;
import org.sourcecode.toolkit.starter.annotation.EnableLoggerRecord;
import org.sourcecode.toolkit.starter.diff.DefaultDiffItemsToLoggerContentService;
import org.sourcecode.toolkit.starter.diff.IDiffItemsToLoggerContentService;
import org.sourcecode.toolkit.starter.support.aop.BeanFactoryLoggerRecordAdvisor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordInterceptor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordOperationSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.AnnotationAttributes;
import org.springframework.core.type.AnnotationMetadata;

import java.time.LocalDateTime;
import java.util.List;

/**
 * @ClassName LoggerRecordProxyAutoConfiguration
 * @Description LoggerRecordProxyAutoConfiguration
 * @Author LiuQi
 */
@Configuration
@EnableConfigurationProperties(value = {LoggerRecordProperties.class})
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
    public LoggerRecordInterceptor loggerRecordInterceptor(LoggerRecordProperties properties) {
        LOGGER.info(" // TODO ........ {}",properties);
        LoggerRecordInterceptor loggerRecordInterceptor = new LoggerRecordInterceptor();
        loggerRecordInterceptor.setTenant(annotationAttributes.getString("tenant"));
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
    public DiffParseFunction diffParseFunction(IDiffItemsToLoggerContentService diffItemsToLoggerContentService, LoggerRecordProperties properties) {
        DiffParseFunction diffParseFunction = new DiffParseFunction();
        diffParseFunction.addUseEqualsClass(LocalDateTime.class);
        diffParseFunction.setDiffItemsToLoggerContentService(diffItemsToLoggerContentService);
        // TODO ...............
        return diffParseFunction;
    }

    @Bean
    @ConditionalOnMissingBean(value = IDiffItemsToLoggerContentService.class)
    @Role(BeanDefinition.ROLE_APPLICATION)
    public IDiffItemsToLoggerContentService diffItemsToLoggerContentService(LoggerRecordProperties properties) {
        return new DefaultDiffItemsToLoggerContentService(properties);
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
