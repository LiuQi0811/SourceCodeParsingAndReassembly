package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.bean.Operator;
import org.sourcecode.toolkit.service.IOperatorGetService;

/**
 * @ClassName DefaultOperatorGetServiceImpl
 * @Description DefaultOperatorGetServiceImpl
 * @Author LiuQi
 */
public class DefaultOperatorGetServiceImpl implements IOperatorGetService {

    @Override
    public Operator getUser() {
        Operator operator = new Operator();
        operator.setOperatorId("ADMIN_");
        return operator;
    }
}
