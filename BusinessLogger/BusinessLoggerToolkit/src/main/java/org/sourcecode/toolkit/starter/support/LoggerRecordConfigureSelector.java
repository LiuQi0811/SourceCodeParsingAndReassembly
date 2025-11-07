package org.sourcecode.toolkit.starter.support;


import org.sourcecode.toolkit.starter.annotation.EnableLoggerRecord;
import org.sourcecode.toolkit.starter.configuration.LoggerRecordProxyAutoConfiguration;
import org.springframework.context.annotation.AdviceMode;
import org.springframework.context.annotation.AdviceModeImportSelector;
import org.springframework.context.annotation.AutoProxyRegistrar;
import org.springframework.lang.Nullable;

/**
 * @ClassName LoggerRecordConfigureSelector
 * @Description LoggerRecordConfigureSelector
 * @Author LiuQi
 */
public class LoggerRecordConfigureSelector extends AdviceModeImportSelector<EnableLoggerRecord> {

    @Override
    @Nullable
    protected String[] selectImports(AdviceMode adviceMode) {
        switch (adviceMode) {
            case PROXY -> {
                return new String[]{AutoProxyRegistrar.class.getName(), LoggerRecordProxyAutoConfiguration.class.getName()};
            }
            case ASPECTJ -> {
                return new String[]{LoggerRecordProxyAutoConfiguration.class.getName()};
            }
            default -> {
                return null;
            }
        }
    }
}
