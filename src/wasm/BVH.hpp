#ifndef BVH_HPP
#define BVH_HPP

#include "simpleIntersect.hpp"

struct vert{
    point3 point;
    vec3 norm;
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

    std::vector<vert> Vertex;
    std::vector<BVH> Node;
    std::vector<tri3> TexCoord;

    void construct_BVH_internal(std::vector<std::array<int,3>> polygon,int index){

        int V = polygon.size();
        if(V<=0){return;}
        if(V==1){
            //ポリゴンが1個しかないならここを葉ノードにする
            point3 P={INFF,INFF,INFF},Q = {-INFF,-INFF,-INFF};
            for(int j=0;j<3;j++){
                P.x = std::min(P.x,Vertex[polygon[0][j]].point.x);
                P.y = std::min(P.y,Vertex[polygon[0][j]].point.y);
                P.z = std::min(P.z,Vertex[polygon[0][j]].point.z);
                Q.x = std::max(Q.x,Vertex[polygon[0][j]].point.x);
                Q.y = std::max(Q.y,Vertex[polygon[0][j]].point.y);
                Q.z = std::max(Q.z,Vertex[polygon[0][j]].point.z);
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
            coor[i] = (Vertex[polygon[i][0]].point.x+Vertex[polygon[i][1]].point.x+Vertex[polygon[i][2]].point.x)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        double med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_x[2];
        point3 p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].point.x+Vertex[polygon[i][1]].point.x+Vertex[polygon[i][2]].point.x)/3.0 < med){
                poly_x[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].point.x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].point.y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].point.z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].point.x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].point.y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].point.z);
                }
            }else{
                poly_x[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].point.x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].point.y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].point.z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].point.x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].point.y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].point.z);
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
            coor[i] = (Vertex[polygon[i][0]].point.y+Vertex[polygon[i][1]].point.y+Vertex[polygon[i][2]].point.y)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_y[2];
        p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].point.y+Vertex[polygon[i][1]].point.y+Vertex[polygon[i][2]].point.y)/3.0 < med){
                poly_y[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].point.x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].point.y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].point.z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].point.x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].point.y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].point.z);
                }
            }else{
                poly_y[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].point.x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].point.y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].point.z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].point.x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].point.y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].point.z);
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
            coor[i] = (Vertex[polygon[i][0]].point.z+Vertex[polygon[i][1]].point.z+Vertex[polygon[i][2]].point.z)/3.0;
        }
        std::sort(coor.begin(),coor.end());
        med = coor[V/2];
        if(V%2==0)med = (coor[V/2]+coor[(V-1)/2])/2.0;

        std::vector<std::array<int,3>> poly_z[2];
        p1={INFF,INFF,INFF},q1 = {-INFF,-INFF,-INFF},p2={INFF,INFF,INFF},q2 = {-INFF,-INFF,-INFF};
        for(int i=0;i<V;i++){
            if((Vertex[polygon[i][0]].point.z+Vertex[polygon[i][1]].point.z+Vertex[polygon[i][2]].point.z)/3.0 < med){
                poly_z[0].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p1.x = std::min(p1.x,Vertex[polygon[i][j]].point.x);
                    p1.y = std::min(p1.y,Vertex[polygon[i][j]].point.y);
                    p1.z = std::min(p1.z,Vertex[polygon[i][j]].point.z);
                    q1.x = std::max(q1.x,Vertex[polygon[i][j]].point.x);
                    q1.y = std::max(q1.y,Vertex[polygon[i][j]].point.y);
                    q1.z = std::max(q1.z,Vertex[polygon[i][j]].point.z);
                }
            }else{
                poly_z[1].push_back(polygon[i]);
                for(int j=0;j<3;j++){
                    p2.x = std::min(p2.x,Vertex[polygon[i][j]].point.x);
                    p2.y = std::min(p2.y,Vertex[polygon[i][j]].point.y);
                    p2.z = std::min(p2.z,Vertex[polygon[i][j]].point.z);
                    q2.x = std::max(q2.x,Vertex[polygon[i][j]].point.x);
                    q2.y = std::max(q2.y,Vertex[polygon[i][j]].point.y);
                    q2.z = std::max(q2.z,Vertex[polygon[i][j]].point.z);
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
                P.x = std::min(P.x,Vertex[polygon[i][j]].point.x);
                P.y = std::min(P.y,Vertex[polygon[i][j]].point.y);
                P.z = std::min(P.z,Vertex[polygon[i][j]].point.z);
                Q.x = std::max(Q.x,Vertex[polygon[i][j]].point.x);
                Q.y = std::max(Q.y,Vertex[polygon[i][j]].point.y);
                Q.z = std::max(Q.z,Vertex[polygon[i][j]].point.z);
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
    
    void construct(std::vector<vert> vertex,std::vector<std::array<int,3>> polygon,std::vector<tri3> texcoord){
        Vertex = vertex;
        Node.clear();
        Node.resize(1);
        TexCoord = texcoord;
        construct_BVH_internal(polygon,0);
    }

    private:    
    rayHit intersectModel_internal(point3 o,vec3 d,int index){

        if(Node[index].isLeaf){
            tri3 tri;
            tri.vertex[0] = Vertex[Node[index].triangle[0]].point,tri.vertex[1] = Vertex[Node[index].triangle[1]].point,tri.vertex[2] = Vertex[Node[index].triangle[2]].point;
            rayHit P = intersectTriangle(o,d,tri);
            if(!P.isHit){
                return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
            }
            vec3 n0 = Vertex[Node[index].triangle[0]].norm, n1 = Vertex[Node[index].triangle[1]].norm, n2 = Vertex[Node[index].triangle[2]].norm;
            tri3 tex = TexCoord[index];

            double zu = P.u,zv = P.v,zw = 1.0-P.u-P.v;
            vec3 Z = {zw*zw,zu*zu,zv*zv};
            double Zl = Z.x+Z.y+Z.z;
            double w = Z.x/Zl,u = Z.y/Zl,v = Z.z/Zl;
            return {
                P.isHit,
                P.point,
                index,
                normalize({
                    w*n0.x + u*n1.x + v*n2.x,
                    w*n0.y + u*n1.y + v*n2.y,
                    w*n0.z + u*n1.z + v*n2.z,
                }),
                P.u,
                P.v,
                {
                    (1-P.u-P.v)*tex.vertex[0].x+P.u*(tex.vertex[1].x)+P.v*(tex.vertex[2].x),
                    (1-P.u-P.v)*tex.vertex[0].y+P.u*(tex.vertex[1].y)+P.v*(tex.vertex[2].y),
                    (1-P.u-P.v)*tex.vertex[0].z+P.u*(tex.vertex[1].z)+P.v*(tex.vertex[2].z)
                }
                //normalVector({Vertex[Node[index].triangle[0]].point,Vertex[Node[index].triangle[1]].point,Vertex[Node[index].triangle[2]].point})
            };
        }

        int child1 = Node[index].children[0], child2 = Node[index].children[1];
        std::pair<bool,point3> inter1 = intersectBox(o,d,Node[child1].Box_m,Node[child1].Box_M);
        std::pair<bool,point3> inter2 = intersectBox(o,d,Node[child2].Box_m,Node[child2].Box_M);

        if(!inter1.first && !inter2.first){
            return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
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
            return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
        }
        if(!col1.isHit){
            return col2;
        }
        if(!col2.isHit){
            return col1;
        }
        double dx1 = col1.point.x-o.x,dy1 = col1.point.y-o.y,dz1 = col1.point.z-o.z;
        double dx2 = col2.point.x-o.x,dy2 = col2.point.y-o.y,dz2 = col2.point.z-o.z; 
        if(dx1*dx1+dy1*dy1+dz1*dz1 <= dx2*dx2+dy2*dy2+dz2*dz2){
            return col1;
        }else{
            return col2;
        }
        return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
    }
    
    public:
    //rayの始点oと向きdを与えると、予め与えたモデルの表面にrayが当たるかを判定し、当たらないならfalseを、当たるならtrueとそのポイントを返す
    rayHit intersectModel(point3 o,vec3 d){
        if(!intersectBox(o,d,Node[0].Box_m,Node[0].Box_M).first){
            return {false,{INFF,INFF,INFF},-1,{0,0,0},-1,-1,{INFF,INFF,INFF}};
        }
        return intersectModel_internal(o,d,0);
    }

};

#endif
