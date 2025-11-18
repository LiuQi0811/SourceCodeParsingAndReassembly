package org.sourcecode.server;


import org.junit.jupiter.api.Test;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordOperationSource;

import java.lang.reflect.Method;

/**
 * @ClassName LoggerRecordOperationSourceTest
 * @Description LoggerRecordOperationSourceTest
 * @Author LiuQi
 */
public class LoggerRecordOperationSourceTest {
    @Test
    public void getInterfaceMethodIfPossible() throws NoSuchMethodException {
        Method method = DoMainService.class.getMethod("doStuff");
        Method interfaceMethodIfPossible = LoggerRecordOperationSource.getInterfaceMethodIfPossible(method);
        System.out.println(interfaceMethodIfPossible.getName());
    }

    @Test
    public void getInterfaceMethodIfPossibleInterface() throws NoSuchMethodException {
        Method method = IService.class.getMethod("doStuff");
        Method interfaceMethodIfPossible = LoggerRecordOperationSource.getInterfaceMethodIfPossible(method);
        System.out.println(interfaceMethodIfPossible);
    }

    @Test
    public void getInterfaceMethodIfPossibleObject() throws NoSuchMethodException {
        Method method = Object.class.getMethod("toString");
        Method interfaceMethodIfPossible = LoggerRecordOperationSource.getInterfaceMethodIfPossible(method);
        System.out.println(interfaceMethodIfPossible);
    }

    interface IService{
        void doStuff();
    }
    static class DoMainService implements IService{

        @Override
        public void doStuff() {

        }

        public void unDoStuff(){

        }
    }
}
