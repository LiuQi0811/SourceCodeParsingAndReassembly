package org.sourcecode.xml.handler;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.xml.parser.BusinessLoggerBeanDefinitionParser;
import org.springframework.beans.factory.xml.NamespaceHandlerSupport;

/**
 * @ClassName BusinessLoggerNameSpaceHandler
 * @Description BusinessLoggerNameSpaceHandler
 * @Author LiuQi
 */
public class BusinessLoggerNameSpaceHandler extends NamespaceHandlerSupport {
    private static final Logger LOGGER = LoggerFactory.getLogger(BusinessLoggerNameSpaceHandler.class);

    @Override
    public void init() {
        LOGGER.info(" BusinessLoggerNameSpaceHandler  Initialized ............. ");
        registerBeanDefinitionParser("business-logger", new BusinessLoggerBeanDefinitionParser());
    }
}
