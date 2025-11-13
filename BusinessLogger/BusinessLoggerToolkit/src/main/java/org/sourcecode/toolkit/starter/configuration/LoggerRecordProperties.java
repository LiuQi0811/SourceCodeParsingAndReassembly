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
    private String fieldSeparator = "；";


    private static final String FIELD_PLACEHOLDER = "__fieldName";
    private static final String SOURCE_VALUE_PLACEHOLDER = "__sourceValue";
    private static final String TARGET_VALUE_PLACEHOLDER = "__targetValue";
    private static final String LIST_ADD_VALUE_PLACEHOLDER = "__addValues";
    private static final String LIST_DELETE_VALUE_PLACEHOLDER = "__deleteValues";

    private String addTemplate = "【" + FIELD_PLACEHOLDER + "】从【空】修改为【" + TARGET_VALUE_PLACEHOLDER + "】";
    private static final String addTemplateForList = "【" + FIELD_PLACEHOLDER + "】添加了【" + LIST_ADD_VALUE_PLACEHOLDER + "】";

    private String deleteTemplate = "删除了【" + FIELD_PLACEHOLDER + "】：【" + SOURCE_VALUE_PLACEHOLDER + "】";
    private String deleteTemplateForList = "【" + FIELD_PLACEHOLDER + "】删除了【" + LIST_DELETE_VALUE_PLACEHOLDER + "】";

    private static final String updateTemplate = "【" + FIELD_PLACEHOLDER + "】从【" + SOURCE_VALUE_PLACEHOLDER + "】修改为【" + TARGET_VALUE_PLACEHOLDER + "】";
    private static final String updateTemplateForList = "【" + FIELD_PLACEHOLDER + "】添加了【" + LIST_ADD_VALUE_PLACEHOLDER + "】删除了【" + LIST_DELETE_VALUE_PLACEHOLDER + "】";

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

    public String getFieldSeparator() {
        return fieldSeparator;
    }

    public void setFieldSeparator(String fieldSeparator) {
        this.fieldSeparator = fieldSeparator;
    }

    public String formatAdd(String fieldName, Object targetValue) {
        return addTemplate.replace(FIELD_PLACEHOLDER, fieldName)
                .replace(TARGET_VALUE_PLACEHOLDER, String.valueOf(targetValue));
    }

    public String formatDeleted(String fieldName, Object sourceValue) {
        return deleteTemplate.replace(FIELD_PLACEHOLDER, fieldName)
                .replace(SOURCE_VALUE_PLACEHOLDER, String.valueOf(sourceValue));
    }

    public String formatUpdate(String fieldName, Object sourceValue, Object targetValue) {
        return updateTemplate.replace(FIELD_PLACEHOLDER, fieldName)
                .replace(SOURCE_VALUE_PLACEHOLDER, String.valueOf(sourceValue))
                .replace(TARGET_VALUE_PLACEHOLDER, String.valueOf(targetValue));
    }

    public String formatList(String fieldName, String insertContent, String removeContent) {
        if (!Util.isEmpty(insertContent) && Util.isEmpty(removeContent)) {
            return addTemplateForList.replace(FIELD_PLACEHOLDER, fieldName)
                    .replace(LIST_ADD_VALUE_PLACEHOLDER, insertContent);
        }
        if (Util.isEmpty(insertContent) && !Util.isEmpty(removeContent)) {
            return deleteTemplateForList.replace(FIELD_PLACEHOLDER, fieldName)
                    .replace(LIST_DELETE_VALUE_PLACEHOLDER, removeContent);
        }
        if (!Util.isEmpty(insertContent) && !Util.isEmpty(removeContent)) {
            return updateTemplateForList.replace(FIELD_PLACEHOLDER, fieldName)
                    .replace(LIST_ADD_VALUE_PLACEHOLDER, insertContent)
                    .replace(LIST_DELETE_VALUE_PLACEHOLDER, removeContent);
        }
        return Util.EMPTY;
    }
}
