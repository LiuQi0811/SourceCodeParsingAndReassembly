package org.sourcecode.toolkit.starter.configuration;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @ClassName LoggerRecordProperties
 * @Description LoggerRecordProperties
 * @Author LiuQi
 */
@ConfigurationProperties(prefix = "logger.record")
public class LoggerRecordProperties {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggerRecordProperties.class);

    private String ofWord = "的";
    private String listItemSeparator = "，";


    private final String FIELD_PLACEHOLDER = "__fieldName";
    private final String LIST_ADD_VALUE_PLACEHOLDER = "__addValues";
    private final String LIST_DELETE_VALUE_PLACEHOLDER = "__deleteValues";
    private String updateTemplateForList = "【" + FIELD_PLACEHOLDER + "】添加了【" + LIST_ADD_VALUE_PLACEHOLDER + "】删除了【" + LIST_DELETE_VALUE_PLACEHOLDER + "】";

    public String getOfWord() {
        return ofWord;
    }

    public void setOfWord(String ofWord) {
        this.ofWord = ofWord;
    }

    public String getListItemSeparator() {
        return listItemSeparator;
    }

    public void setListItemSeparator(String listItemSeparator) {
        this.listItemSeparator = listItemSeparator;
    }

    public String formatList(String fieldName, String insertContent, String removeContent) {
        if (!Util.isEmpty(insertContent) && Util.isEmpty(removeContent)) {
            LOGGER.info(" >>>>>>>1>>>>>>>>>> {} {} {} ", fieldName, insertContent, removeContent);
        }
        if (Util.isEmpty(insertContent) && !Util.isEmpty(removeContent)) {
            LOGGER.info(" >>>>>>>>>2>>>>>>>> {} {} {} ", fieldName, insertContent, removeContent);
        }
        if (!Util.isEmpty(insertContent) && !Util.isEmpty(removeContent)) {
            return updateTemplateForList.replace(FIELD_PLACEHOLDER, fieldName)
                    .replace(LIST_ADD_VALUE_PLACEHOLDER, insertContent)
                    .replace(LIST_DELETE_VALUE_PLACEHOLDER, removeContent);
        }
        return Util.EMPTY;
    }
}
