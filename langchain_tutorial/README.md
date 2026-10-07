### 全局忽略所有目录下的.env 文件
```shell
# 放在.gitignore
**/.env
```
### 精准指定位置
```shell 
langchain_tutorial/.env
```

### 把已经被 Git 追踪的.env 从暂存区移除（本地文件保留不动）
```shell
git rm --cached langchain_tutorial/.env
```

### 软重置（推荐，保留你本地文件，只撤销 commit，文件还在，不会丢代码） 回退到上一个commit，本地文件全部保留，取消本次提交
```shell
git reset --soft HEAD~1
```
- `HEAD~1`：退回到**当前提交的上一个版本**
- `-soft`：撤销 commit，**本地代码不变**，文件回到待暂存状态，`.env`还在你的电脑里，不会删除。