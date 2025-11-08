package org.sourcecode.toolkit.starter.configuration;


import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.sourcecode.toolkit.service.IParseFunction;
import org.sourcecode.toolkit.service.impl.DefaultFunctionServiceImpl;
import org.sourcecode.toolkit.service.impl.DefaultLoggerRecordServiceImpl;
import org.sourcecode.toolkit.service.impl.DefaultParseFunction;
import org.sourcecode.toolkit.service.impl.ParseFunctionFactory;
import org.sourcecode.toolkit.starter.support.aop.BeanFactoryLoggerRecordAdvisor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordInterceptor;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordOperationSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import org.springframework.core.type.AnnotationMetadata;

import java.util.List;

/**
 * @ClassName LoggerRecordProxyAutoConfiguration
 * @Description LoggerRecordProxyAutoConfiguration
 * @Author LiuQi
 */
@Configuration
public class LoggerRecordProxyAutoConfiguration implements ImportAware {

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
        LoggerRecordInterceptor loggerRecordInterceptor = new LoggerRecordInterceptor();
        loggerRecordInterceptor.setLoggerRecordOperationSource(loggerRecordOperationSource());
        return loggerRecordInterceptor;
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
    @ConditionalOnMissingBean(value = ILoggerRecordService.class)
    @Role(value = BeanDefinition.ROLE_APPLICATION)
    public ILoggerRecordService recordService() {
        return new DefaultLoggerRecordServiceImpl();
    }

    @Override
    public void setImportMetadata(AnnotationMetadata importMetadata) {

    }
}
