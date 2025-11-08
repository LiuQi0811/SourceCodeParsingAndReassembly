package org.sourcecode.server.function;


import org.sourcecode.toolkit.service.IParseFunction;
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
}
