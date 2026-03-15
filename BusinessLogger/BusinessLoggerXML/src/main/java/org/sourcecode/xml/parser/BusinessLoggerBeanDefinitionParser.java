package org.sourcecode.xml.parser;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.xml.BeanDefinitionParser;
import org.springframework.beans.factory.xml.ParserContext;
import org.w3c.dom.Element;

/**
 * @ClassName BusinessLoggerBeanDefinitionParser
 * @Description BusinessLoggerBeanDefinitionParser
 * @Author LiuQi
 */
public class BusinessLoggerBeanDefinitionParser implements BeanDefinitionParser {
    private static final Logger LOGGER = LoggerFactory.getLogger(BusinessLoggerBeanDefinitionParser.class);
    @Override
    public BeanDefinition parse(Element element, ParserContext parserContext) {
        LOGGER.info(" BusinessLoggerBeanDefinitionParser Initialized ............. ");
        return null;
    }
}
