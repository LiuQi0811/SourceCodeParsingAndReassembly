package org.sourcecode.toolkit.starter.configuration;


import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @ClassName LoggerRecordProperties
 * @Description LoggerRecordProperties
 * @Author LiuQi
 */
@ConfigurationProperties(prefix = "logger.record")
public class LoggerRecordProperties {
    private String ofWord = "的";

    public String getOfWord() {
        return ofWord;
    }

    public void setOfWord(String ofWord) {
        this.ofWord = ofWord;
    }
}
