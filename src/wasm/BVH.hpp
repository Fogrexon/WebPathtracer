#include "simpleIntersect.hpp"

struct rayHit{
    bool isHit;
    point3 point;
    int index;
    vec3 normal;
};

//モデルにBVHを与える関数のクラス
class ModelBVH {

    private:

    //BVHをしたときの木の頂点
    //AABBや子頂点や葉ならポリゴンの情報を持っている
    struct BVH{
        point3 Box_m,Box_M; //AABBの対角線上の2頂点
        bool isLeaf; //葉ならtrue、子を持つならfalse
        std::array<int,2> children; //子頂点のインデックス
        std::array<int,3> triangle; //葉が持っている三角形
    };

    std::vector<point3> Vertex;
    std::vector<BVH> Node;

    void construct_BVH_internal(std::vector<std::array<int,3>> polygon,int index){

        int V = polygon.size();
        if(V<=0){return;}
        if(V==1){
            //ポリゴンが1個しかないならここを葉ノードにする
            point3 P={INFF,INFF,INFF},Q = {-INFF,-INFF,-INFF};
            for(int j=0;j<3;j++){
                P.x = std::min(P.x,Vertex[polygon[0][j]].x);
                P.y = std::min(P.y,Vertex[polygon[0][j]].y);
                P.z = std::min(P.z,Vertex[polygon[0][j]].z);
                Q.x = std::max(Q.x,Vertex[polygon[0][j]].x);
                Q.y = std::max(Q.y,Vertex[polygon[0][j]].y);
                Q.z = std::max(Q.z,Vertex[polygon[0][j]].z);
            }

            BVH bvh;
            bvh.Box_m = P;
            bvh.Box_M = Q;
            bvh.isLeaf = true;
            bvh.triangle = polygon[0];
            
            Node[index] = bvh;
            return ;
        }

        //ポリゴンの重心の座標をもとに、ポリゴンの数が均等になるように大きく2つに分ける
        //TODO:重心が同じ2つのポリゴンが存在すると死にます

        //X軸
        std::vector<double> coor(V);
        for(int i=0;i<V;i++){
            coor[i] = (Vertex[polygon[i][0]].x+Vertex[polygon[i][1]].x+Vertex[polygon[i][2]].x)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        double med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_x[2];
        point3 p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].x+Vertex[polygon[i][1]].x+Vertex[polygon[i][2]].x)/3.0 < med){
                poly_x[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].z);
                }
            }else{
                poly_x[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].z);
                }
                
            }
        }

        double surx = 2.0*((q1.y-p1.y)*(q1.z-p1.z)+(q1.z-p1.z)*(q1.x-p1.x)+(q1.x-p1.x)*(q1.y-p1.y))
                        + 2.0*((q2.y-p2.y)*(q2.z-p2.z)+(q2.z-p2.z)*(q2.x-p2.x)+(q2.x-p2.x)*(q2.y-p2.y));
        if(poly_x[0].empty() || poly_x[1].empty()){
            surx = INFF;
        }

        //Y軸
        for(int i=0;i<V;i++){
            coor[i] = (Vertex[polygon[i][0]].y+Vertex[polygon[i][1]].y+Vertex[polygon[i][2]].y)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_y[2];
        p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].y+Vertex[polygon[i][1]].y+Vertex[polygon[i][2]].y)/3.0 < med){
                poly_y[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].z);
                }
            }else{
                poly_y[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].z);
                }
                
            }
        }

        double sury = 2.0*((q1.y-p1.y)*(q1.z-p1.z)+(q1.z-p1.z)*(q1.x-p1.x)+(q1.x-p1.x)*(q1.y-p1.y))
                        + 2.0*((q2.y-p2.y)*(q2.z-p2.z)+(q2.z-p2.z)*(q2.x-p2.x)+(q2.x-p2.x)*(q2.y-p2.y));
        if(poly_y[0].empty() || poly_y[1].empty()){
            sury = INFF;
        }

        //Z軸
        for(int i=0;i<V;i++){
            coor[i] = (Vertex[polygon[i][0]].z+Vertex[polygon[i][1]].z+Vertex[polygon[i][2]].z)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_z[2];
        p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].z+Vertex[polygon[i][1]].z+Vertex[polygon[i][2]].z)/3.0 < med){
                poly_z[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].z);
                }
            }else{
                poly_z[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].z);
                }
                
            }
        }

        double surz = 2.0*((q1.y-p1.y)*(q1.z-p1.z)+(q1.z-p1.z)*(q1.x-p1.x)+(q1.x-p1.x)*(q1.y-p1.y))
                        + 2.0*((q2.y-p2.y)*(q2.z-p2.z)+(q2.z-p2.z)*(q2.x-p2.x)+(q2.x-p2.x)*(q2.y-p2.y));
        if(poly_z[0].empty() || poly_z[1].empty()){
            surz = INFF;
        }

        //３つの軸で、その軸を基準に分解したときの分解の仕方とその表面積が計算できた
        //分解の均等さ<表面積の小ささで採用する軸を決定する
        //２つに分けたものをそれぞれ次のBVH計算に与える
        point3 P={INFF,INFF,INFF},Q = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            for(int j=0;j<3;j++){
                P.x = std::min(P.x,Vertex[polygon[i][j]].x);
                P.y = std::min(P.y,Vertex[polygon[i][j]].y);
                P.z = std::min(P.z,Vertex[polygon[i][j]].z);
                Q.x = std::max(Q.x,Vertex[polygon[i][j]].x);
                Q.y = std::max(Q.y,Vertex[polygon[i][j]].y);
                Q.z = std::max(Q.z,Vertex[polygon[i][j]].z);
            }
        }

        BVH bvh;
        bvh.Box_m = P;
        bvh.Box_M = Q;
        bvh.isLeaf = false;

        int n = Node.size();
        Node.resize(n+2);
        bvh.children[0] = n;
        bvh.children[1] = n+1;

        Node[index] = bvh;

        assert(std::min({surx,sury,surz})!=INFF);
        std::vector<std::tuple<int,double,int>> decide(3);
        decide[0] = {std::abs((int)poly_x[0].size()-(int)poly_x[1].size()),surx,0};
        decide[1] = {std::abs((int)poly_y[0].size()-(int)poly_y[1].size()),sury,1};
        decide[2] = {std::abs((int)poly_z[0].size()-(int)poly_z[1].size()),surz,2};
        std::sort(decide.begin(),decide.end());

        if(std::get<2>(decide[0])==0){
            construct_BVH_internal(poly_x[0],n);
            construct_BVH_internal(poly_x[1],n+1);
        }else if(std::get<2>(decide[0])==1){
            construct_BVH_internal(poly_y[0],n);
            construct_BVH_internal(poly_y[1],n+1);
        }else{
            construct_BVH_internal(poly_z[0],n);
            construct_BVH_internal(poly_z[1],n+1);
        }

    }

    public:
    
    void construct(std::vector<point3> vertex,std::vector<std::array<int,3>> polygon){
        Vertex = vertex;
        Node.clear();
        Node.resize(1);
        construct_BVH_internal(polygon,0);
    }

    private:    
    rayHit intersectModel_internal(point3 o,vec3 d,int index){

        if(Node[index].isLeaf){
            tri3 tri;
            tri.vertex[0] = Vertex[Node[index].triangle[0]],tri.vertex[1] = Vertex[Node[index].triangle[1]],tri.vertex[2] = Vertex[Node[index].triangle[2]];
            std::pair<bool,point3> P = intersectTriangle(o,d,tri);
            if(!P.first){
                return {false,{INFF,INFF,INFF},-1,{0,0,0}};
            }
            return {
                P.first,
                P.second,
                index,
                normalVector({Vertex[Node[index].triangle[0]],Vertex[Node[index].triangle[1]],Vertex[Node[index].triangle[2]]})
            };
        }

        int child1 = Node[index].children[0], child2 = Node[index].children[1];
        std::pair<bool,point3> inter1 = intersectBox(o,d,Node[child1].Box_m,Node[child1].Box_M);
        std::pair<bool,point3> inter2 = intersectBox(o,d,Node[child2].Box_m,Node[child2].Box_M);

        if(!inter1.first && !inter2.first){
            return {false,{INFF,INFF,INFF},-1,{0,0,0}};
        }
        if(!inter1.first){
            return intersectModel_internal(o,d,child2);
        }
        if(!inter2.first){
            return intersectModel_internal(o,d,child1);
        }
        rayHit col1 = intersectModel_internal(o,d,child1);
        rayHit col2 = intersectModel_internal(o,d,child2);

        if(!col1.isHit && !col2.isHit){
            return {false,{INFF,INFF,INFF},-1,{0,0,0}};
        }
        if(!col1.isHit){
            return col2;
        }
        if(!col2.isHit){
            return col1;
        }
        if(std::abs(col1.point.x-o.x)<=std::abs(col2.point.x-o.x)){
            return col1;
        }else{
            return col2;
        }
        return {false,{INFF,INFF,INFF},-1,{0,0,0}};
    }
    
    public:
    //rayの始点oと向きdを与えると、予め与えたモデルの表面にrayが当たるかを判定し、当たらないならfalseを、当たるならtrueとそのポイントを返す
    rayHit intersectModel(point3 o,vec3 d){
        if(!intersectBox(o,d,Node[0].Box_m,Node[0].Box_M).first){
            return {false,{INFF,INFF,INFF},-1,{0,0,0}};
        }
        return intersectModel_internal(o,d,0);
    }

};