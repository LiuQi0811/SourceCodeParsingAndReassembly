package org.sourcecode.server.infrastructure.loggerRecord.function;


import org.sourcecode.toolkit.service.IParseFunction;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.stereotype.Component;

/**
 * @ClassName OrderParseFunction
 * @Description OrderParseFunction
 * @Author LiuQi
 */
@Component
public class OrderParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return "ORDER";
    }

    @Override
    public boolean executeBefore() {
        return false;
    }

    @Override
    public String apply(Object value) {
        if (Util.isEmpty(value)) {
            return Util.EMPTY;
        }
        return value.toString();
    }
}
