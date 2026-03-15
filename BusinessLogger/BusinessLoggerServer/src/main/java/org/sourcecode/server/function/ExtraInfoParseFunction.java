package org.sourcecode.server.function;


import org.sourcecode.toolkit.service.IParseFunction;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.stereotype.Component;

/**
 * @ClassName ExtraInfoParseFunction
 * @Description ExtraInfoParseFunction
 * @Author LiuQi
 */
@Component
public class ExtraInfoParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return "extraInfo";
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
