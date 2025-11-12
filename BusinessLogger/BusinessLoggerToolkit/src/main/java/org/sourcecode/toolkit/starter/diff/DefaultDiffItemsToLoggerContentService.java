package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.node.DiffNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.beans.factory.SmartInitializingSingleton;

/**
 * @ClassName DefaultDiffItemsToLoggerContentService
 * @Description DefaultDiffItemsToLoggerContentService
 * @Author LiuQi
 */
public class DefaultDiffItemsToLoggerContentService implements IDiffItemsToLoggerContentService, BeanFactoryAware, SmartInitializingSingleton {
    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultDiffItemsToLoggerContentService.class);
    @Override
    public String toLoggerContent(DiffNode diffNode, Object value, Object value_) {
        // TODO .....
        LOGGER.info(" // TODO DefaultDiffItemsToLoggerContentService  toLoggerContent ");
        return "";
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        // TODO .....
        LOGGER.info(" // TODO DefaultDiffItemsToLoggerContentService  setBeanFactory");
    }

    @Override
    public void afterSingletonsInstantiated() {
        // TODO .....
        LOGGER.info(" // TODO DefaultDiffItemsToLoggerContentService  afterSingletonsInstantiated");
    }
}
